import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';

export function useChartSortPageBySpansHandler(sort: string) {
  const router = useRouter();
  const location = useLocation();
  return (_, chartRef) => {
    // This is kind of jank but we need to check if the chart is hovered because
    // onDataZoom is fired for all charts when one chart is zoomed.
    const hoveredEchartElement = Array.from(document.querySelectorAll(':hover')).find(
      element => {
        return element.classList.contains('echarts-for-react');
      }
    );
    const echartElement = document.querySelector(`[_echarts_instance_="${chartRef.id}"]`);
    if (hoveredEchartElement === echartElement) {
      router.replace({
        pathname: location.pathname,
        query: {...location.query, spansSort: sort},
      });
    }
  };
}
