import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';

export const vertex = () => `
attribute vec2 a_position;
attribute vec4 a_color;
attribute vec4 a_bounds;

uniform mat3 u_model;
uniform mat3 u_projection;

varying lowp vec4 v_color;
varying vec2 v_pos;
varying vec4 v_bounds;

void main() {
  vec2 scaled = (u_model * vec3(a_position.xy, 1)).xy;
  vec2 pos = (u_projection * vec3(scaled.xy, 1)).xy;

  gl_Position = vec4(pos, 0.0, 1.0);

  v_color = a_color;
  v_pos = a_position.xy;
  v_bounds = a_bounds;
}
`;

export const fragment = (theme: FlamegraphTheme) => `
// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default
precision mediump float;

uniform bool u_is_search_result;
uniform vec2 u_border_width;
uniform bool u_draw_border;

varying lowp vec4 v_color;
varying vec4 v_bounds;
varying vec2 v_pos;

void main() {
  float minX = v_bounds.x + u_border_width.x;
  float maxX = v_bounds.z - u_border_width.x;

  float minY = v_bounds.y + u_border_width.y;
  float maxY = v_bounds.y + 1.0 - u_border_width.y;

  float width = maxX - minX;

  if (u_is_search_result) {
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
