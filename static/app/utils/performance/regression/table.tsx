import styled from '@emotion/styled';

import {GridColumnOrder} from 'sentry/components/gridEditable';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {RateUnits} from 'sentry/utils/discover/fields';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

function getPercentChange(before: number, after: number) {
  return ((after - before) / before) * 100;
}

export function renderHeadCell(column: GridColumnOrder<string>) {
  if (['spm', 'p95'].includes(column.key)) {
    return <NumericColumnLabel>{column.name}</NumericColumnLabel>;
  }
  return column.name;
}

export function NumericChange({
  columnKey,
  beforeRawValue,
  afterRawValue,
}: {
  afterRawValue: number;
  beforeRawValue: number;
  columnKey: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const percentChange = getPercentChange(beforeRawValue, afterRawValue);

  const unit = columnKey === 'p95' ? 'millisecond' : RateUnits.PER_MINUTE;
  const renderer = (value: number) =>
    getFieldRenderer(
      columnKey,
      {
        p95: 'duration',
        spm: 'rate',
      },
      false
    )({[columnKey]: value}, {organization, location, unit});

  if (Math.round(percentChange) !== 0) {
    let percentChangeLabel = `${percentChange > 0 ? '+' : ''}${Math.round(
      percentChange
    )}%`;
    if (beforeRawValue === 0) {
      percentChangeLabel = t('New');
    }
    return (
      <Change>
        {renderer(beforeRawValue)}
        <IconArrow direction="right" size="xs" />
        {renderer(afterRawValue)}
        <ChangeLabel isPositive={percentChange > 0} isNeutral={beforeRawValue === 0}>
          ({percentChangeLabel})
        </ChangeLabel>
      </Change>
    );
  }

  return (
    <Change>
      {renderer(afterRawValue)}
      <ChangeDescription>{t('(No significant change)')}</ChangeDescription>
    </Change>
  );
}

export const NumericColumnLabel = styled('div')`
  text-align: right;
  width: 100%;
`;

const ChangeLabel = styled('div')<{isNeutral: boolean; isPositive: boolean}>`
  color: ${p => {
    if (p.isNeutral) {
      return p.theme.gray300;
    }
    if (p.isPositive) {
      return p.theme.red300;
    }
    return p.theme.green300;
  }};
  text-align: right;
`;

const Change = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  justify-content: right;

  ${NumberContainer} {
    width: unset;
  }
`;

const ChangeDescription = styled('span')`
  color: ${p => p.theme.gray300};
  white-space: nowrap;
`;
