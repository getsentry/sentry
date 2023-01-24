import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';

export const vertex = () => `
attribute vec2 a_position;
attribute vec4 a_color;
attribute vec4 a_bounds;
attribute float a_is_search_result;

uniform mat3 u_model;
uniform mat3 u_projection;

varying vec4 v_color;
varying vec2 v_pos;
varying vec4 v_bounds;
varying float v_is_search_result;

void main() {
  vec2 scaled = (u_model * vec3(a_position.xy, 1)).xy;
  vec2 pos = (u_projection * vec3(scaled.xy, 1)).xy;

  gl_Position = vec4(pos, 0.0, 1.0);

  v_color = a_color;
  v_pos = a_position.xy;
  v_bounds = a_bounds;
  v_is_search_result = a_is_search_result;
}
`;

export const fragment = (theme: FlamegraphTheme) => `
precision mediump float;

uniform vec2 u_border_width;
uniform bool u_draw_border;

varying vec4 v_color;
varying vec4 v_bounds;
varying vec2 v_pos;
varying float v_is_search_result;

void main() {
  float minX = v_bounds.x + u_border_width.x;
  float maxX = v_bounds.z - u_border_width.x;

  float minY = v_bounds.y + u_border_width.y;
  float maxY = v_bounds.y + 1.0 - u_border_width.y;

  float width = maxX - minX;

  if (v_is_search_result == 1.0) {
    gl_FragColor = ${theme.COLORS.SEARCH_RESULT_FRAME_COLOR};
  } else if (u_draw_border) {
    if(width <= u_border_width.x) {
      if(v_pos.y > minY && v_pos.y < maxY){
        gl_FragColor = vec4(v_color);
      } else {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      }
    } else if (v_pos.x > minX && v_pos.x < maxX && v_pos.y > minY && v_pos.y < maxY) {
      gl_FragColor = vec4(v_color);
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
  } else {
    gl_FragColor = vec4(v_color);
  }
}
`;

export const uiFramesVertext = () => `
  attribute vec2 a_position;
  attribute float a_frame_type;

  uniform mat3 u_model;
  uniform mat3 u_projection;

  varying float v_frame_type;

  void main() {
    vec2 scaled = (u_model * vec3(a_position.xy, 1)).xy;
    vec2 pos = (u_projection * vec3(scaled.xy, 1)).xy;

    gl_Position = vec4(pos, 0.0, 1.0);

    v_frame_type = a_frame_type;
  }
`;

export const uiFramesFragment = (theme: FlamegraphTheme) => `
precision mediump float;

varying float v_frame_type;

void main() {
  if(v_frame_type == 1.0) {
    gl_FragColor = ${theme.COLORS.UI_FRAME_COLOR_FROZEN};
  } else {
    gl_FragColor = ${theme.COLORS.UI_FRAME_COLOR_SLOW};
  }
}
`;
