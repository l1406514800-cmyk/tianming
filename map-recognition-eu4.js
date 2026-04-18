// EU4风格的地图识别
// 基于颜色ID识别省份

/**
 * EU4风格地图识别
 * 每个省份使用唯一的RGB颜色
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapEU4Style(image, options, progressCallback) {
    options = options || {};
    const minArea = options.minArea || 100;
    const colorTolerance = options.colorTolerance || 1;
    const maxSize = options.maxSize || 1500; // 最大尺寸限制

    return new Promise((resolve, reject) => {
        try {
            console.log('EU4风格地图识别...', {
                size: `${image.width}x${image.height}`
            });

            if (progressCallback) progressCallback(5, '正在准备图片...');

            // 如果图片太大，先缩小
            let processImage = image;
            let scale = 1;
            if (image.width > maxSize || image.height > maxSize) {
                scale = Math.min(maxSize / image.width, maxSize / image.height);
                console.log('图片过大，缩小到', Math.round(scale * 100) + '%');

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.round(image.width * scale);
                tempCanvas.height = Math.round(image.height * scale);
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);

                // 创建新的Image对象
                processImage = new Image();
                processImage.src = tempCanvas.toDataURL();

                // 等待图片加载
                processImage.onload = function() {
                    continueRecognition(processImage, scale);
                };
                return;
            }

            continueRecognition(processImage, scale);

            function continueRecognition(img, scaleRatio) {
                if (progressCallback) progressCallback(10, '正在加载图片...');

                // 创建Canvas
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const pixels = imageData.data;

                if (progressCallback) progressCallback(20, '正在分析颜色...');

                // 步骤1: 收集所有唯一颜色
                console.log('步骤1: 分析颜色...');
                const colorMap = buildColorMap(pixels, img.width, img.height, colorTolerance);
                console.log('发现', colorMap.size, '种不同颜色');

                if (progressCallback) progressCallback(40, `发现 ${colorMap.size} 种颜色，正在识别省份...`);

                // 步骤2: 为每种颜色识别区域
                console.log('步骤2: 识别省份...');
                identifyRegionsByColor(pixels, img.width, img.height, colorMap, minArea, progressCallback).then(regions => {
                    console.log('识别到', regions.length, '个省份');

                    if (progressCallback) progressCallback(80, `识别到 ${regions.length} 个省份，正在提取边界...`);

                    // 步骤3: 提取边界和属性
                    console.log('步骤3: 提取边界...');
                    const processedRegions = regions.map((region, index) => {
                        const boundary = extractRegionBoundary(region.pixels, img.width, img.height);
                        const center = calculateRegionCenter(region.pixels);

                        if (progressCallback && index % 10 === 0) {
                            const percent = 80 + (index / regions.length) * 15;
                            progressCallback(percent, `处理省份 ${index + 1}/${regions.length}...`);
                        }

                        // 如果图片被缩放了，需要将坐标还原
                        const scaledBoundary = scaleRatio !== 1
                            ? boundary.map(([x, y]) => [Math.round(x / scaleRatio), Math.round(y / scaleRatio)])
                            : boundary;
                        const scaledCenter = scaleRatio !== 1
                            ? [Math.round(center[0] / scaleRatio), Math.round(center[1] / scaleRatio)]
                            : center;

                        return {
                            id: 'province_' + (index + 1),
                            name: '省份' + (index + 1),
                            color: region.color,
                            boundary: scaledBoundary,
                            center: scaledCenter,
                            area: region.pixels.length
                        };
                    });

                    if (progressCallback) progressCallback(95, '正在完成...');

                    console.log('识别完成！');

                    if (progressCallback) progressCallback(100, '识别完成！');

                    resolve(processedRegions);
                }).catch(error => {
                    reject(error);
                });
            }
        } catch (error) {
            console.error('识别失败:', error);
            reject(error);
        }
    });
}

/**
 * 构建颜色映射表
 */
function buildColorMap(pixels, width, height, tolerance) {
    const colorMap = new Map();
    const visited = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (visited[idx]) continue;

            const pixelIdx = idx * 4;
            const r = pixels[pixelIdx];
            const g = pixels[pixelIdx + 1];
            const b = pixels[pixelIdx + 2];

            // 跳过纯黑色（边界线）
            if (r < 10 && g < 10 && b < 10) {
                visited[idx] = 1;
                continue;
            }

            const colorKey = `${r},${g},${b}`;

            // 查找是否已有相似颜色
            let foundColor = null;
            for (const [key, data] of colorMap.entries()) {
                const [kr, kg, kb] = key.split(',').map(Number);
                const diff = Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb);
                if (diff <= tolerance) {
                    foundColor = key;
                    break;
                }
            }

            if (foundColor) {
                colorMap.get(foundColor).count++;
            } else {
                colorMap.set(colorKey, {
                    r, g, b,
                    count: 1
                });
            }

            visited[idx] = 1;
        }
    }

    return colorMap;
}

/**
 * 按颜色识别区域（分块执行，避免阻塞）
 */
function identifyRegionsByColor(pixels, width, height, colorMap, minArea, progressCallback) {
    const regions = [];
    const visited = new Uint8Array(width * height);
    const totalPixels = width * height;
    let processedPixels = 0;
    let cancelled = false;

    // 暴露取消函数
    window._cancelMapRecognition = function() {
        cancelled = true;
    };

    return new Promise((resolve, reject) => {
        let y = 0;

        function processChunk() {
            if (cancelled) {
                reject(new Error('用户取消'));
                return;
            }

            const startTime = Date.now();
            const chunkSize = 50; // 每次处理50行

            for (let row = 0; row < chunkSize && y < height; row++, y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (visited[idx]) continue;

                    const pixelIdx = idx * 4;
                    const r = pixels[pixelIdx];
                    const g = pixels[pixelIdx + 1];
                    const b = pixels[pixelIdx + 2];

                    // 跳过黑色边界
                    if (r < 10 && g < 10 && b < 10) {
                        visited[idx] = 1;
                        continue;
                    }

                    // 洪水填充相同颜色的区域
                    const regionPixels = floodFillByColor(x, y, r, g, b, pixels, width, height, visited);

                    if (regionPixels.length >= minArea) {
                        regions.push({
                            pixels: regionPixels,
                            color: `rgb(${r},${g},${b})`
                        });
                    }

                    processedPixels += regionPixels.length;
                }
            }

            // 更新进度
            if (progressCallback) {
                const percent = 40 + (y / height) * 35;
                progressCallback(percent, `识别省份中... ${regions.length} 个`);
            }

            // 继续处理或完成
            if (y < height) {
                setTimeout(processChunk, 0); // 让出控制权
            } else {
                delete window._cancelMapRecognition;
                resolve(regions);
            }
        }

        processChunk();
    });
}

/**
 * 按颜色洪水填充
 */
function floodFillByColor(startX, startY, targetR, targetG, targetB, pixels, width, height, visited) {
    const stack = [[startX, startY]];
    const regionPixels = [];
    const tolerance = 3; // 进一步降低容差到3，避免海洋和岛屿混淆

    while (stack.length > 0) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;
        if (visited[idx]) continue;

        const pixelIdx = idx * 4;
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const b = pixels[pixelIdx + 2];

        // 检查颜色是否匹配
        const diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
        if (diff > tolerance) continue;

        visited[idx] = 1;
        regionPixels.push([x, y]);

        // 4方向扩展
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }

    return regionPixels;
}

/**
 * 提取区域边界
 */
function extractRegionBoundary(pixels, width, height) {
    if (pixels.length === 0) return [];

    // 创建像素集合
    const pixelSet = new Set();
    for (const [x, y] of pixels) {
        pixelSet.add(y * width + x);
    }

    // 找到边界像素
    const boundaryPixels = [];
    for (const [x, y] of pixels) {
        const idx = y * width + x;
        let isBoundary = false;

        // 检查4邻域
        if (!pixelSet.has(idx - 1) || !pixelSet.has(idx + 1) ||
            !pixelSet.has(idx - width) || !pixelSet.has(idx + width)) {
            isBoundary = true;
        }

        if (isBoundary) {
            boundaryPixels.push([x, y]);
        }
    }

    // 简化边界
    if (boundaryPixels.length > 50) {
        return simplifyPolygon(boundaryPixels, 3.0);
    }

    return boundaryPixels;
}

/**
 * 简化多边形
 */
function simplifyPolygon(points, epsilon) {
    if (points.length < 3) return points;

    let maxDist = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = pointLineDistance(points[i], start, end);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    if (maxDist > epsilon) {
        const left = simplifyPolygon(points.slice(0, maxIndex + 1), epsilon);
        const right = simplifyPolygon(points.slice(maxIndex), epsilon);
        return left.slice(0, -1).concat(right);
    } else {
        return [start, end];
    }
}

/**
 * 点到线段距离
 */
function pointLineDistance(point, lineStart, lineEnd) {
    const [px, py] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算区域中心
 */
function calculateRegionCenter(pixels) {
    if (pixels.length === 0) return [0, 0];

    let sumX = 0, sumY = 0;
    for (const [x, y] of pixels) {
        sumX += x;
        sumY += y;
    }

    return [
        Math.round(sumX / pixels.length),
        Math.round(sumY / pixels.length)
    ];
}

/**
 * 加载并识别地图（EU4风格）
 */
async function loadAndRecognizeMapEU4Style(imageFile, options, progressCallback) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    const regions = await recognizeMapEU4Style(img, options, progressCallback);

                    const mapData = {
                        name: imageFile.name.replace(/\.[^/.]+$/, ''),
                        width: img.width,
                        height: img.height,
                        backgroundImage: img,
                        regions: regions.map(region => ({
                            id: region.id,
                            name: region.name,
                            coords: region.boundary.flat(),
                            center: region.center,
                            terrain: 'plains',
                            owner: '',
                            color: region.color,
                            resources: [],
                            development: 50,
                            troops: 0,
                            characters: [],
                            neighbors: []
                        }))
                    };

                    resolve(mapData);

                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = function() {
                reject(new Error('图片加载失败'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('文件读取失败'));
        };

        reader.readAsDataURL(imageFile);
    });
}

// 导出函数
if (typeof window !== 'undefined') {
    window.recognizeMapEU4Style = recognizeMapEU4Style;
    window.loadAndRecognizeMapEU4Style = loadAndRecognizeMapEU4Style;
}
