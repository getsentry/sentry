import {useLayoutEffect} from 'react';
import * as echarts from 'echarts/core';

export function useChartGroup(groupName: string, deps?: React.DependencyList) {
  useLayoutEffect(() => {
    echarts.connect(groupName);
  }, [groupName, deps]);
}
