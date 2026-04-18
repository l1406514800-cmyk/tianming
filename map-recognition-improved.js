// 改进的边界线识别 - 高质量版本
// 平衡性能和质量

/**
 * 改进的边界线识别
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapByBordersImproved(image, options) {
    options = options || {};
    const borderThreshold = options.borderThreshold || 100;
    const minArea = options.minArea || 500; // 提高最小面积到500
    const maxSize = 1600; // 提高到1600px保留更多细节

    return new Promise((resolve, reject) => {
        try {
            // 计算缩放比例
            const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
            const targetWidth = Math.floor(image.width * scale);
            const targetHeight = Math.floor(image.height * scale);

            console.log('改进边界线识别...', {
                original: `${image.width}x${image.height}`,
                scaled: `${targetWidth}x${targetHeight}`,
                scale: scale.toFixed(2)
            });

            // 创建Canvas
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const pixels = imageData.data;

            // 步骤1: 检测边界线
            console.log('步骤1: 检测边界线...');
            const borderMap = detectBordersImproved(pixels, targetWidth, targetHeight, borderThreshold);

            // 步骤2: 加粗边界线（确保封闭）
            console.log('步骤2: 加粗边界线...');
            thickenBorders(borderMap, targetWidth, targetHeight);

            // 步骤3: 识别封闭区域
            console.log('步骤3: 识别封闭区域...');
            const regions = findEnclosedRegionsImproved(borderMap, targetWidth, targetHeight, minArea);

            // 过滤掉细长区域（长宽比过大的）
            const filteredRegions = regions.filter(region => {
                const bounds = getBounds(region.pixels);
                const width = bounds.maxX - bounds.minX;
                const height = bounds.maxY - bounds.minY;
                const aspectRatio = Math.max(width, height) / Math.min(width, height);

                // 更严格的过滤：长宽比<5，且面积足够大
                return aspectRatio < 5 && region.pixels.length >= minArea * 2;
            });

            console.log('识别到', filteredRegions.length, '个地块（已过滤细长区域）');

            // 创建原始图片的canvas（只创建一次）
            const originalCanvas = document.createElement('canvas');
            originalCanvas.width = image.width;
            originalCanvas.height = image.height;
            const originalCtx = originalCanvas.getContext('2d');
            originalCtx.drawImage(image, 0, 0);
            const originalImageData = originalCtx.getImageData(0, 0, image.width, image.height);
            const originalPixels = originalImageData.data;

            // 步骤4: 提取真实边界（不是矩形）
            console.log('步骤4: 提取边界...');
            const processedRegions = filteredRegions.map((region, index) => {
                const boundary = extractRealBoundary(region.pixels, targetWidth, targetHeight);
                const center = calculateCenter(region.pixels);

                // 缩放回原始尺寸
                const scaledBoundary = boundary.map(p => [
                    Math.round(p[0] / scale),
                    Math.round(p[1] / scale)
                ]);
                const scaledCenter = [
                    Math.round(center[0] / scale),
                    Math.round(center[1] / scale)
                ];

                // 从原始图片提取颜色
                const color = extractRegionColorFromOriginal(originalPixels, scaledCenter, image.width, image.height);

                // 调试：输出前10个地块的颜色
                if (index < 10) {
                    console.log(`地块${index + 1}: 中心(${scaledCenter[0]}, ${scaledCenter[1]}), 颜色: ${color}`);
                }

                return {
                    id: 'region_' + (index + 1),
                    name: '地块' + (index + 1),
                    color: color,
                    boundary: scaledBoundary,
                    center: scaledCenter,
                    area: region.pixels.length
                };
            });

            console.log('识别完成！');
            resolve(processedRegions);

        } catch (error) {
            console.error('识别失败:', error);
            reject(error);
        }
    });
}

/**
 * 改进的边界线检测
 */
function detectBordersImproved(pixels, width, height, threshold) {
    const borderMap = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            // 使用加权亮度计算（更准确）
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (brightness < threshold) {
                borderMap[y * width + x] = 1;
            }
        }
    }

    return borderMap;
}

/**
 * 加粗边界线（确保封闭）
 */
function thickenBorders(borderMap, width, height) {
    const temp = new Uint8Array(borderMap);

    // 膨胀操作 - 让边界线更粗
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (temp[idx] === 1) {
                // 膨胀到8邻域
                borderMap[idx - 1] = 1;
                borderMap[idx + 1] = 1;
                borderMap[idx - width] = 1;
                borderMap[idx + width] = 1;
                borderMap[idx - width - 1] = 1;
                borderMap[idx - width + 1] = 1;
                borderMap[idx + width - 1] = 1;
                borderMap[idx + width + 1] = 1;
            }
        }
    }
}

/**
 * 获取区域边界框
 */
function getBounds(pixels) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const [x, y] of pixels) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    return { minX, minY, maxX, maxY };
}

/**
 * 填充边界线间隙（形态学闭运算）
 */
function closeBorderGaps(borderMap, width, height) {
    const temp = new Uint8Array(borderMap);

    // 膨胀操作
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (borderMap[idx] === 1) {
                // 膨胀到8邻域
                temp[idx - 1] = 1;
                temp[idx + 1] = 1;
                temp[idx - width] = 1;
                temp[idx + width] = 1;
            }
        }
    }

    // 腐蚀操作
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (temp[idx] === 1) {
                let count = 0;
                // 检查8邻域
                if (temp[idx - 1] === 1) count++;
                if (temp[idx + 1] === 1) count++;
                if (temp[idx - width] === 1) count++;
                if (temp[idx + width] === 1) count++;

                if (count >= 2) {
                    borderMap[idx] = 1;
                }
            }
        }
    }
}

/**
 * 改进的封闭区域识别（不跳步）
 */
function findEnclosedRegionsImproved(borderMap, width, height, minArea) {
    const visited = new Uint8Array(width * height);
    const regions = [];

    // 不跳步，逐像素扫描
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            if (borderMap[idx] === 1 || visited[idx] === 1) {
                continue;
            }

            const regionPixels = floodFillImproved(x, y, width, height, borderMap, visited);

            if (regionPixels.length >= minArea) {
                regions.push({ pixels: regionPixels });
            }
        }
    }

    return regions;
}

/**
 * 改进的洪水填充
 */
function floodFillImproved(startX, startY, width, height, borderMap, visited) {
    const stack = [[startX, startY]];
    const regionPixels = [];
    const maxPixels = 50000; // 提高限制

    while (stack.length > 0 && regionPixels.length < maxPixels) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;
        if (borderMap[idx] === 1 || visited[idx] === 1) continue;

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
 * 提取真实边界（轮廓跟踪）
 */
function extractRealBoundary(pixels, width, height) {
    if (pixels.length === 0) return [];

    // 创建像素集合用于快速查找
    const pixelSet = new Set();
    for (const [x, y] of pixels) {
        pixelSet.add(y * width + x);
    }

    // 找到边界像素（至少有一个邻居不在区域内）
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

    // 简化边界（Douglas-Peucker算法）
    if (boundaryPixels.length > 100) {
        return simplifyBoundary(boundaryPixels, 2.0);
    }

    return boundaryPixels;
}

/**
 * Douglas-Peucker边界简化算法
 */
function simplifyBoundary(points, epsilon) {
    if (points.length < 3) return points;

    // 找到距离起点和终点连线最远的点
    let maxDist = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = pointToLineDistance(points[i], start, end);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    // 如果最大距离大于阈值，递归简化
    if (maxDist > epsilon) {
        const left = simplifyBoundary(points.slice(0, maxIndex + 1), epsilon);
        const right = simplifyBoundary(points.slice(maxIndex), epsilon);
        return left.slice(0, -1).concat(right);
    } else {
        return [start, end];
    }
}

/**
 * 点到线段的距离
 */
function pointToLineDistance(point, lineStart, lineEnd) {
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
 * 从原始图片提取区域颜色
 */
function extractRegionColorFromOriginal(pixels, center, width, height) {
    const [cx, cy] = center;

    // 确保坐标在范围内
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) {
        return '#666666';
    }

    // 在中心点周围采样多个点
    const samples = [];
    const radius = 5;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const x = cx + dx;
            const y = cy + dy;

            if (x >= 0 && x < width && y >= 0 && y < height) {
                const idx = (y * width + x) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];

                // 排除黑色边界线
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                if (brightness > 100) {
                    samples.push([r, g, b]);
                }
            }
        }
    }

    if (samples.length === 0) {
        return '#666666';
    }

    // 计算平均颜色
    let r = 0, g = 0, b = 0;
    for (const [sr, sg, sb] of samples) {
        r += sr;
        g += sg;
        b += sb;
    }

    r = Math.round(r / samples.length);
    g = Math.round(g / samples.length);
    b = Math.round(b / samples.length);

    return `rgb(${r},${g},${b})`;
}

/**
 * 提取区域颜色
 */
function extractRegionColor(pixels, regionPixels, width) {
    if (regionPixels.length === 0) return '#666666';

    // 采样多个点取平均
    const sampleCount = Math.min(10, regionPixels.length);
    const step = Math.floor(regionPixels.length / sampleCount);

    let r = 0, g = 0, b = 0;

    for (let i = 0; i < sampleCount; i++) {
        const [x, y] = regionPixels[i * step];
        const idx = (y * width + x) * 4;
        r += pixels[idx] || 0;
        g += pixels[idx + 1] || 0;
        b += pixels[idx + 2] || 0;
    }

    r = Math.round(r / sampleCount);
    g = Math.round(g / sampleCount);
    b = Math.round(b / sampleCount);

    return `rgb(${r},${g},${b})`;
}

/**
 * 计算中心点
 */
function calculateCenter(pixels) {
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
 * 加载并识别地图
 */
async function loadAndRecognizeMapByBordersImproved(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    const regions = await recognizeMapByBordersImproved(img, options);

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
    window.recognizeMapByBordersImproved = recognizeMapByBordersImproved;
    window.loadAndRecognizeMapByBordersImproved = loadAndRecognizeMapByBordersImproved;
}
