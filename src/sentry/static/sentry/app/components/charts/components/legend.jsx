import 'echarts/lib/component/legend';
import 'echarts/lib/component/legendScroll';

const DEFAULT_TRUNCATE_LENGTH = 80;

export default function Legend({truncate, ...props} = {}) {
  let truncateLength =
    truncate && typeof truncate === 'number' ? truncate : DEFAULT_TRUNCATE_LENGTH;

  return {
    show: true,
    type: 'scroll',
    padding: 0,
    formatter: truncate
      ? function(name) {
          if (name.length > truncateLength) {
            return name.substring(0, truncateLength) + '...';
          } else {
            return name;
          }
        }
      : null,
    ...props,
  };
}
