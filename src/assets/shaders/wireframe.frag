uniform vec3 uWireframeColor;

void main() {
    gl_FragColor = vec4(uWireframeColor, 1.0);
}
