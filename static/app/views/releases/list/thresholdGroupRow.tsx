import {TableData} from '../components/table';

type Threshold = {
  environment: string;
  project: string;
  thresholdType: string;
  triggerType: string;
  window: string;
};

type Props = {
  environment: string;
  projectName: string;
  thresholds: {[key: string]: any};
};

export function ThresholdGroupRow({environment, projectName, thresholds}: Props) {
  // NOTE: all thresholds in group should have the same project and environment
  return thresholds.map((idx: number, t: Threshold) => (
    <tr key={idx}>
      {/* TODO: grab project icon */}
      <TableData>{!idx ? projectName : ''}</TableData>
      <TableData>{idx === 1 ? environment : ''}</TableData>
      <TableData>{t.window}</TableData>
      <TableData>
        {t.triggerType === 'over' ? '>' : '<'} {t.thresholdType}
      </TableData>
      <TableData />
    </tr>
  ));
}
