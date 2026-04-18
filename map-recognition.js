// 智能地图识别系统
// 自动识别地图图片中的地块并生成可编辑区域

// ============================================================
// 图像处理核心算法
// ============================================================

/**
 * 智能识别地图中的地块
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapRegions(image, options) {
    options = options || {};
    const tolerance = options.tolerance || 10; // 颜色容差
    const minArea = options.minArea || 100; // 最小区域面积
    const simplify = options.simplify !== false; // 是否简化边界

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

            console.log('\u5f00\u59cb\u8bc6\u522b\u5730\u56fe...', {
                width: canvas.width,
                height: canvas.height,
                tolerance: tolerance
            });

            // 步骤1: 颜色聚类 - 识别所有独特的颜色区域
            const colorMap = buildColorMap(pixels, canvas.width, canvas.height, tolerance);
            console.log('\u8bc6\u522b\u5230', colorMap.size, '\u4e2a\u989c\u8272\u533a\u57df');

            // 步骤2: 区域分割 - 使用洪水填充算法
            const regions = floodFillRegions(pixels, canvas.width, canvas.height, colorMap, minArea);
            console.log('\u5206\u5272\u51fa', regions.length, '\u4e2a\u5730\u5757');

            // 步骤3: 边界追踪 - 提取每个区域的边界
            const processedRegions = regions.map((region, index) => {
                const boundary = traceBoundary(region.pixels, canvas.width, canvas.height);

                // 简化边界（减少点数）
                const simplifiedBoundary = simplify ?
                    simplifyBoundary(boundary, 2.0) : boundary;

                // 计算中心点
                const center = calculateCenter(region.pixels);

                return {
                    id: 'region_' + (index + 1),
                    name: '\u5730\u5757' + (index + 1),
                    color: region.color,
                    boundary: simplifiedBoundary,
                    center: center,
                    area: region.pixels.length,
                    pixels: region.pixels
                };
            });

            console.log('\u8bc6\u522b\u5b8c\u6210\uff01');
            resolve(processedRegions);

        } catch (error) {
            console.error('\u8bc6\u522b\u5931\u8d25:', error);
            reject(error);
        }
    });
}

/**
 * 构建颜色映射表
 */
function buildColorMap(pixels, width, height, tolerance) {
    const colorMap = new Map();
    const visited = new Set();

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // 跳过透明像素
        if (a < 128) continue;

        const colorKey = `${r},${g},${b}`;

        // 查找相似颜色
        let found = false;
        for (const [key, value] of colorMap) {
            const [kr, kg, kb] = key.split(',').map(Number);
            const distance = Math.sqrt(
                (r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2
            );

            if (distance <= tolerance) {
                value.count++;
                found = true;
                break;
            }
        }

        if (!found) {
            colorMap.set(colorKey, {
                r, g, b,
                count: 1
            });
        }
    }

    // 过滤掉出现次数太少的颜色（可能是噪点）
    const filtered = new Map();
    for (const [key, value] of colorMap) {
        if (value.count > 50) { // 至少50个像素
            filtered.set(key, value);
        }
    }

    return filtered;
}

/**
 * 洪水填充算法 - 分割区域
 */
function floodFillRegions(pixels, width, height, colorMap, minArea) {
    const visited = new Uint8Array(width * height);
    const regions = [];

    // 为每个颜色创建区域
    for (const [colorKey, colorInfo] of colorMap) {
        const [targetR, targetG, targetB] = colorKey.split(',').map(Number);

        // 查找该颜色的所有连通区域
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (visited[idx]) continue;

                const pixelIdx = idx * 4;
                const r = pixels[pixelIdx];
                const g = pixels[pixelIdx + 1];
                const b = pixels[pixelIdx + 2];

                // 检查颜色是否匹配
                const distance = Math.sqrt(
                    (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2
                );

                if (distance <= 10) {
                    // 洪水填充
                    const regionPixels = floodFill(x, y, width, height, pixels, visited, targetR, targetG, targetB);

                    if (regionPixels.length >= minArea) {
                        regions.push({
                            color: `rgb(${targetR},${targetG},${targetB})`,
                            pixels: regionPixels
                        });
                    }
                }
            }
        }
    }

    return regions;
}

/**
 * 洪水填充单个区域
 */
function floodFill(startX, startY, width, height, pixels, visited, targetR, targetG, targetB) {
    const stack = [[startX, startY]];
    const regionPixels = [];
    const tolerance = 10;

    while (stack.length > 0) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;
        if (visited[idx]) continue;

        const pixelIdx = idx * 4;
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const b = pixels[pixelIdx + 2];

        const distance = Math.sqrt(
            (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2
        );

        if (distance > tolerance) continue;

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
 * 边界追踪算法（Moore邻域追踪）
 */
function traceBoundary(pixels, width, height) {
    if (pixels.length === 0) return [];

    // 创建像素集合用于快速查找
    const pixelSet = new Set(pixels.map(p => `${p[0]},${p[1]}`));

    // 找到最左上角的点作为起点
    let startPoint = pixels[0];
    for (const p of pixels) {
        if (p[1] < startPoint[1] || (p[1] === startPoint[1] && p[0] < startPoint[0])) {
            startPoint = p;
        }
    }

    const boundary = [];
    const directions = [
        [0, -1], [1, -1], [1, 0], [1, 1],
        [0, 1], [-1, 1], [-1, 0], [-1, -1]
    ];

    let current = startPoint;
    let dir = 7; // 从左边开始

    do {
        boundary.push([...current]);

        // 查找下一个边界点
        let found = false;
        for (let i = 0; i < 8; i++) {
            const checkDir = (dir + i) % 8;
            const next = [
                current[0] + directions[checkDir][0],
                current[1] + directions[checkDir][1]
            ];

            if (pixelSet.has(`${next[0]},${next[1]}`)) {
                current = next;
                dir = (checkDir + 5) % 8; // 转向
                found = true;
                break;
            }
        }

        if (!found) break;

        // 防止无限循环
        if (boundary.length > pixels.length * 2) break;

    } while (current[0] !== startPoint[0] || current[1] !== startPoint[1] || boundary.length < 4);

    return boundary;
}

/**
 * 简化边界（Douglas-Peucker算法）
 */
function simplifyBoundary(points, tolerance) {
    if (points.length <= 2) return points;

    // 找到距离起点和终点连线最远的点
    let maxDistance = 0;
    let maxIndex = 0;

    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const distance = pointToLineDistance(points[i], start, end);
        if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
        }
    }

    // 如果最大距离大于容差，递归简化
    if (maxDistance > tolerance) {
        const left = simplifyBoundary(points.slice(0, maxIndex + 1), tolerance);
        const right = simplifyBoundary(points.slice(maxIndex), tolerance);
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

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
        return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;

    return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
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
// 地图识别 UI 集成
// ============================================================

/**
 * 显示识别进度
 */
function showRecognitionProgress(message, progress) {
    let overlay = document.getElementById('recognition-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'recognition-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        `;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div style="text-align: center; color: #e0e0e0;">
            <div style="width: 60px; height: 60px; border: 4px solid #333; border-top-color: #ffd700; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <div style="font-size: 18px; margin-bottom: 10px;">${message}</div>
            ${progress !== undefined ? `<div style="font-size: 14px; color: #aaa;">${progress}%</div>` : ''}
        </div>
    `;
}

function hideRecognitionProgress() {
    const overlay = document.getElementById('recognition-overlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
}

/**
 * 加载并识别地图图片
 */
async function loadAndRecognizeMap(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    showRecognitionProgress('\u6b63\u5728\u5206\u6790\u5730\u56fe...', 0);

                    // 识别地块
                    const regions = await recognizeMapRegions(img, options);

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
    window.recognizeMapRegions = recognizeMapRegions;
    window.loadAndRecognizeMap = loadAndRecognizeMap;
    window.showRecognitionProgress = showRecognitionProgress;
    window.hideRecognitionProgress = hideRecognitionProgress;
}
