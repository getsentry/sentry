import 'echarts/lib/component/legend';
import 'echarts/lib/component/legendScroll';

export default function Legend(props = {}) {
  return {
    show: true,
    type: 'scroll',
    padding: 0,
    formatter: function(name) {
      if (name.length > 80) {
        return name.substring(0, 80) + '...';
      } else {
        return name;
      }
    },
    ...props,
  };
}
