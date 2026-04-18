// 基于边界线的地图识别系统
// 识别黑色边界线围成的地块

// ============================================================
// 边界线识别算法
// ============================================================

/**
 * 基于边界线识别地块
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapByBorders(image, options) {
    options = options || {};
    const borderThreshold = options.borderThreshold || 100; // 边界线阈值（0-255，越小越严格）
    const minArea = options.minArea || 100;
    const fillGaps = options.fillGaps !== false; // 是否填充边界线间隙

    return new Promise((resolve, reject) => {
        try {
            // 创建离屏 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // 获取图像数据
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            console.log('\u5f00\u59cb\u8fb9\u754c\u7ebf\u8bc6\u522b...', {
                width: canvas.width,
                height: canvas.height,
                borderThreshold: borderThreshold
            });

            // 步骤1: 检测边界线（黑色线条）
            const borderMap = detectBorders(pixels, canvas.width, canvas.height, borderThreshold);
            console.log('\u8fb9\u754c\u7ebf\u68c0\u6d4b\u5b8c\u6210');

            // 步骤2: 填充边界线间隙（可选）
            if (fillGaps) {
                fillBorderGaps(borderMap, canvas.width, canvas.height);
                console.log('\u8fb9\u754c\u7ebf\u95f4\u9699\u586b\u5145\u5b8c\u6210');
            }

            // 步骤3: 识别封闭区域
            const regions = findEnclosedRegions(borderMap, canvas.width, canvas.height, minArea);
            console.log('\u8bc6\u522b\u5230', regions.length, '\u4e2a\u5c01\u95ed\u533a\u57df');

            // 步骤4: 提取区域边界
            const processedRegions = regions.map((region, index) => {
                const boundary = extractRegionBoundary(region.pixels, canvas.width, canvas.height);
                const center = calculateCenter(region.pixels);

                // 从原图提取区域颜色
                const color = extractRegionColor(pixels, region.pixels, canvas.width);

                return {
                    id: 'region_' + (index + 1),
                    name: '\u5730\u5757' + (index + 1),
                    color: color,
                    boundary: boundary,
                    center: center,
                    area: region.pixels.length,
                    pixels: region.pixels
                };
            });

            console.log('\u8fb9\u754c\u7ebf\u8bc6\u522b\u5b8c\u6210\uff01');
            resolve(processedRegions);

        } catch (error) {
            console.error('\u8bc6\u522b\u5931\u8d25:', error);
            reject(error);
        }
    });
}

/**
 * 检测边界线（黑色线条）
 */
function detectBorders(pixels, width, height, threshold) {
    const borderMap = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            // 检测黑色或深色像素（边界线）
            // 使用亮度公式：L = 0.299*R + 0.587*G + 0.114*B
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (a > 128 && brightness < threshold) {
                borderMap[y * width + x] = 1; // 标记为边界线
            }
        }
    }

    return borderMap;
}

/**
 * 填充边界线间隙（形态学闭运算）
 */
function fillBorderGaps(borderMap, width, height) {
    const kernel = 2; // 膨胀/腐蚀核大小

    // 膨胀操作
    const dilated = new Uint8Array(width * height);
    for (let y = kernel; y < height - kernel; y++) {
        for (let x = kernel; x < width - kernel; x++) {
            let hasBorder = false;
            for (let dy = -kernel; dy <= kernel; dy++) {
                for (let dx = -kernel; dx <= kernel; dx++) {
                    if (borderMap[(y + dy) * width + (x + dx)] === 1) {
                        hasBorder = true;
                        break;
                    }
                }
                if (hasBorder) break;
            }
            if (hasBorder) {
                dilated[y * width + x] = 1;
            }
        }
    }

    // 腐蚀操作
    for (let y = kernel; y < height - kernel; y++) {
        for (let x = kernel; x < width - kernel; x++) {
            let allBorder = true;
            for (let dy = -kernel; dy <= kernel; dy++) {
                for (let dx = -kernel; dx <= kernel; dx++) {
                    if (dilated[(y + dy) * width + (x + dx)] === 0) {
                        allBorder = false;
                        break;
                    }
                }
                if (!allBorder) break;
            }
            if (allBorder) {
                borderMap[y * width + x] = 1;
            }
        }
    }
}

/**
 * 识别封闭区域（洪水填充非边界区域）
 */
function findEnclosedRegions(borderMap, width, height, minArea) {
    const visited = new Uint8Array(width * height);
    const regions = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            // 跳过边界线和已访问的像素
            if (borderMap[idx] === 1 || visited[idx] === 1) {
                continue;
            }

            // 洪水填充找到封闭区域
            const regionPixels = floodFillRegion(x, y, width, height, borderMap, visited);

            if (regionPixels.length >= minArea) {
                regions.push({
                    pixels: regionPixels
                });
            }
        }
    }

    return regions;
}

/**
 * 洪水填充单个区域（避开边界线）
 */
function floodFillRegion(startX, startY, width, height, borderMap, visited) {
    const stack = [[startX, startY]];
    const regionPixels = [];

    while (stack.length > 0) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;

        // 跳过边界线和已访问的像素
        if (borderMap[idx] === 1 || visited[idx] === 1) continue;

        visited[idx] = 1;
        regionPixels.push([x, y]);

        // 添加四个方向的邻居
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
    const pixelSet = new Set(pixels.map(p => `${p[0]},${p[1]}`));

    // 找到边界点（至少有一个邻居不在区域内）
    const boundaryPoints = [];

    for (const [x, y] of pixels) {
        let isBoundary = false;

        // 检查8个方向的邻居
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;

                if (!pixelSet.has(`${nx},${ny}`)) {
                    isBoundary = true;
                    break;
                }
            }
            if (isBoundary) break;
        }

        if (isBoundary) {
            boundaryPoints.push([x, y]);
        }
    }

    // 对边界点排序（顺时针）
    return sortBoundaryPoints(boundaryPoints);
}

/**
 * 对边界点排序（顺时针）
 */
function sortBoundaryPoints(points) {
    if (points.length === 0) return [];

    // 计算中心点
    let centerX = 0, centerY = 0;
    for (const [x, y] of points) {
        centerX += x;
        centerY += y;
    }
    centerX /= points.length;
    centerY /= points.length;

    // 按极角排序
    points.sort((a, b) => {
        const angleA = Math.atan2(a[1] - centerY, a[0] - centerX);
        const angleB = Math.atan2(b[1] - centerY, b[0] - centerX);
        return angleA - angleB;
    });

    return points;
}

/**
 * 提取区域颜色（取区域内像素的平均颜色）
 */
function extractRegionColor(pixels, regionPixels, width) {
    if (regionPixels.length === 0) return '#666666';

    let r = 0, g = 0, b = 0;
    let count = 0;

    // 采样部分像素（提高性能）
    const sampleSize = Math.min(100, regionPixels.length);
    const step = Math.max(1, Math.floor(regionPixels.length / sampleSize));

    for (let i = 0; i < regionPixels.length; i += step) {
        const [x, y] = regionPixels[i];
        const idx = (y * width + x) * 4;

        r += pixels[idx];
        g += pixels[idx + 1];
        b += pixels[idx + 2];
        count++;
    }

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    return `rgb(${r},${g},${b})`;
}

/**
 * 计算区域中心点
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

// ============================================================
// 增强的识别函数（自动选择算法）
// ============================================================

/**
 * 智能识别地图（自动选择最佳算法）
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function smartRecognizeMap(image, options) {
    options = options || {};

    // 分析图片特征
    const features = analyzeImageFeatures(image);

    console.log('\u56fe\u7247\u7279\u5f81\u5206\u6790:', features);

    // 根据特征选择算法
    if (features.hasBorders) {
        console.log('\u68c0\u6d4b\u5230\u8fb9\u754c\u7ebf\uff0c\u4f7f\u7528\u8fb9\u754c\u7ebf\u8bc6\u522b\u7b97\u6cd5');
        return recognizeMapByBorders(image, options);
    } else {
        console.log('\u672a\u68c0\u6d4b\u5230\u660e\u663e\u8fb9\u754c\u7ebf\uff0c\u4f7f\u7528\u989c\u8272\u5206\u5272\u7b97\u6cd5');
        return recognizeMapRegions(image, options);
    }
}

/**
 * 分析图片特征
 */
function analyzeImageFeatures(image) {
    const canvas = document.createElement('canvas');
    const sampleSize = 200; // 采样尺寸
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const pixels = imageData.data;

    let darkPixels = 0;
    let totalPixels = sampleSize * sampleSize;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (brightness < 100) {
            darkPixels++;
        }
    }

    const darkRatio = darkPixels / totalPixels;

    return {
        hasBorders: darkRatio > 0.05 && darkRatio < 0.3, // 5%-30%的暗像素表示有边界线
        darkRatio: darkRatio
    };
}

// ============================================================
// 更新加载函数
// ============================================================

/**
 * 加载并识别地图（使用边界线算法）
 */
async function loadAndRecognizeMapByBorders(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    showRecognitionProgress('\u6b63\u5728\u68c0\u6d4b\u8fb9\u754c\u7ebf...', 10);

                    // 使用边界线识别
                    const regions = await recognizeMapByBorders(img, options);

                    showRecognitionProgress('\u6b63\u5728\u751f\u6210\u53ef\u7f16\u8f91\u5730\u5757...', 80);

                    // 转换为编辑器格式
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

                    hideRecognitionProgress();
                    resolve(mapData);

                } catch (error) {
                    hideRecognitionProgress();
                    reject(error);
                }
            };

            img.onerror = function() {
                hideRecognitionProgress();
                reject(new Error('\u56fe\u7247\u52a0\u8f7d\u5931\u8d25'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('\u6587\u4ef6\u8bfb\u53d6\u5931\u8d25'));
        };

        reader.readAsDataURL(imageFile);
    });
}

// ============================================================
// 导出函数
// ============================================================

if (typeof window !== 'undefined') {
    window.recognizeMapByBorders = recognizeMapByBorders;
    window.smartRecognizeMap = smartRecognizeMap;
    window.loadAndRecognizeMapByBorders = loadAndRecognizeMapByBorders;
}
