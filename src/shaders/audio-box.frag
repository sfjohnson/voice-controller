#version 300 es
precision mediump float;

in vec2 Pos;
out vec4 FragColour;
uniform float uLevel, uCapturing;

void main () {
  if (Pos.y > 1.0 - uLevel) {
    if (uCapturing > 0.0) {
      FragColour = vec4(0.59, 0.84, 0.52, 1.0);
    } else {
      FragColour = vec4(0.93, 0.79, 0.63, 1.0);
    }
  } else {
    FragColour = vec4(1.0, 1.0, 1.0, 1.0);
  }
}
