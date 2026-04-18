// 优化的边界线识别 - 快速版本
// 通过缩小图片提高性能

/**
 * 快速边界线识别（优化版）
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapByBordersFast(image, options) {
    options = options || {};
    const borderThreshold = options.borderThreshold || 100;
    const minArea = options.minArea || 50;
    const maxSize = 800; // 最大处理尺寸

    return new Promise((resolve, reject) => {
        try {
            // 计算缩放比例
            const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
            const targetWidth = Math.floor(image.width * scale);
            const targetHeight = Math.floor(image.height * scale);

            console.log('\u5feb\u901f\u8fb9\u754c\u7ebf\u8bc6\u522b...', {
                original: `${image.width}x${image.height}`,
                scaled: `${targetWidth}x${targetHeight}`,
                scale: scale.toFixed(2)
            });

            // 创建缩小的 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const pixels = imageData.data;

            // 步骤1: 快速检测边界线
            const borderMap = detectBordersFast(pixels, targetWidth, targetHeight, borderThreshold);

            // 步骤2: 识别封闭区域
            const regions = findEnclosedRegionsFast(borderMap, targetWidth, targetHeight, minArea);
            console.log('\u8bc6\u522b\u5230', regions.length, '\u4e2a\u5730\u5757');

            // 步骤3: 提取边界并缩放回原始尺寸
            const processedRegions = regions.map((region, index) => {
                const boundary = extractSimpleBoundary(region.pixels);
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

                return {
                    id: 'region_' + (index + 1),
                    name: '\u5730\u5757' + (index + 1),
                    color: extractRegionColorFast(pixels, region.pixels, targetWidth),
                    boundary: scaledBoundary,
                    center: scaledCenter,
                    area: region.pixels.length
                };
            });

            console.log('\u5feb\u901f\u8bc6\u522b\u5b8c\u6210\uff01');
            resolve(processedRegions);

        } catch (error) {
            console.error('\u8bc6\u522b\u5931\u8d25:', error);
            reject(error);
        }
    });
}

/**
 * 快速边界线检测
 */
function detectBordersFast(pixels, width, height, threshold) {
    const borderMap = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            // 简化的亮度计算
            const brightness = (r + g + b) / 3;

            if (brightness < threshold) {
                borderMap[y * width + x] = 1;
            }
        }
    }

    return borderMap;
}

/**
 * 快速封闭区域识别
 */
function findEnclosedRegionsFast(borderMap, width, height, minArea) {
    const visited = new Uint8Array(width * height);
    const regions = [];

    // 使用更大的步长加速
    const step = 2;

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = y * width + x;

            if (borderMap[idx] === 1 || visited[idx] === 1) {
                continue;
            }

            const regionPixels = floodFillFast(x, y, width, height, borderMap, visited);

            if (regionPixels.length >= minArea) {
                regions.push({ pixels: regionPixels });
            }
        }
    }

    return regions;
}

/**
 * 快速洪水填充
 */
function floodFillFast(startX, startY, width, height, borderMap, visited) {
    const stack = [[startX, startY]];
    const regionPixels = [];
    const maxPixels = 10000; // 限制最大像素数

    while (stack.length > 0 && regionPixels.length < maxPixels) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;
        if (borderMap[idx] === 1 || visited[idx] === 1) continue;

        visited[idx] = 1;
        regionPixels.push([x, y]);

        // 只检查4个方向（不检查对角线）
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }

    return regionPixels;
}

/**
 * 提取简化边界
 */
function extractSimpleBoundary(pixels) {
    if (pixels.length === 0) return [];

    // 找到边界框
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const [x, y] of pixels) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    // 返回矩形边界（简化版）
    return [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY]
    ];
}

/**
 * 快速提取区域颜色
 */
function extractRegionColorFast(pixels, regionPixels, width) {
    if (regionPixels.length === 0) return '#666666';

    // 只采样中心点
    const center = calculateCenter(regionPixels);
    const idx = (Math.floor(center[1]) * width + Math.floor(center[0])) * 4;

    const r = pixels[idx] || 100;
    const g = pixels[idx + 1] || 100;
    const b = pixels[idx + 2] || 100;

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
 * 快速加载并识别地图
 */
async function loadAndRecognizeMapByBordersFast(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    showRecognitionProgress('\u6b63\u5728\u5feb\u901f\u8bc6\u522b...', 20);

                    const regions = await recognizeMapByBordersFast(img, options);

                    showRecognitionProgress('\u6b63\u5728\u751f\u6210\u5730\u5757...', 80);

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

// 导出函数
if (typeof window !== 'undefined') {
    window.recognizeMapByBordersFast = recognizeMapByBordersFast;
    window.loadAndRecognizeMapByBordersFast = loadAndRecognizeMapByBordersFast;
}
