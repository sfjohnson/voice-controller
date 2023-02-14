#version 300 es
precision mediump float;

in vec2 Pos;
out vec4 FragColour;
uniform float uType, uHue, uSat, uBri, uMyValue;

// https://stackoverflow.com/a/54014428
float f1 (float n, float hue, float sat, float lum) {
  float k = mod(n + hue/30.0, 12.0);
  float min1 = min(k-3.0, 9.0-k);
  float min2 = min(min1, 1.0);
  sat *= 0.01;
  lum *= 0.01;
  return lum - sat * min(lum, 1.0 - lum) * max(min2, -1.0);
}

// https://stackoverflow.com/a/54024653
float f2 (float n, float hue, float sat, float bri) {
  float k = mod(n + hue/60.0, 6.0);
  float min1 = min(k, 4.0-k);
  float min2 = min(min1, 1.0);
  sat *= 0.01;
  bri *= 0.01;
  return bri - bri * sat * max(min2, 0.0);
}

// input: h in [0,360] and s,l in [0,100] - output: r,g,b in [0,1]
vec4 hsl2rgba (float hue, float sat, float lum) {
  return vec4(f1(0.0, hue, sat, lum), f1(8.0, hue, sat, lum), f1(4.0, hue, sat, lum), 1.0);
}

// input: h in [0,360] and s,b in [0,100] - output: r,g,b in [0,1]
vec4 hsb2rgba (float hue, float sat, float bri) {
  return vec4(f2(5.0, hue, sat, bri), f2(3.0, hue, sat, bri), f2(1.0, hue, sat, bri), 1.0);
}

void main () {
  if (uType == 3.0 || uMyValue < 0.0) {
    // colour temp or value is null
    FragColour = vec4(0.9, 0.9, 0.9, 1.0);
    return;
  }

  float scaledY = uType == 0.0 ? 360.0 * (1.0-Pos.y) : 100.0 * (1.0-Pos.y);
  float barHeight = uType == 0.0 ? 1.8 : 0.5;

  if (uHue < 0.0 || uSat < 0.0 || uBri < 0.0) {
    // at least one of the values is null, don't render a gradient
    FragColour = vec4(0.9, 0.9, 0.9, 1.0);
  } else if (uType == 0.0) {
    // hue
    FragColour = hsb2rgba(scaledY, 100.0, 100.0);
  } else if (uType == 1.0) {
    // saturation
    FragColour = hsb2rgba(uHue, scaledY, uBri);
  } else if (uType == 2.0) {
    // brightness
    FragColour = hsb2rgba(uHue, uSat, scaledY);
  }

  // render the bar
  if (scaledY >= uMyValue - barHeight && scaledY <= uMyValue + barHeight) {
    if (FragColour.r + FragColour.g + FragColour.b > 1.5) {
      FragColour = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      FragColour = vec4(1.0, 1.0, 1.0, 1.0);
    }
  }
}
