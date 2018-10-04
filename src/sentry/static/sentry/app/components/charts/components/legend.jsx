import 'echarts/lib/component/legend';
import 'echarts/lib/component/legendScroll';

export default function Legend({truncate, ...props} = {}) {
  return {
    show: true,
    type: 'scroll',
    padding: 0,
    formatter: truncate
      ? function(name) {
          if (name.length > truncate) {
            return name.substring(0, truncate) + '...';
          } else {
            return name;
          }
        }
      : null,
    ...props,
  };
}
