import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {
  ColumnCompactSelect,
  DirectionCompactSelect,
} from 'sentry/views/explore/toolbar/toolbarSortBy';

export function ErrorsToolbarSortBy() {
  return (
    <ToolbarSection data-test-id="section-sort-by">
      <ToolbarHeader>
        <Tooltip
          position="right"
          title={t('Results you see first and last in your samples or aggregates.')}
        >
          <ToolbarLabel disabled={false}>{t('Sort By')}</ToolbarLabel>
        </Tooltip>
      </ToolbarHeader>
      <ToolbarRow>
        <ColumnCompactSelect options={[]} value="" onChange={() => {}} disabled={false} />
        <DirectionCompactSelect
          options={[
            {label: 'Desc', value: 'desc', textValue: 'desc'},
            {label: 'Asc', value: 'asc', textValue: 'asc'},
          ]}
          value="desc"
          onChange={() => {}}
          disabled={false}
        />
      </ToolbarRow>
    </ToolbarSection>
  );
}
