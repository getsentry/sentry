import {type ComponentProps, Fragment} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {
  CompactSelect,
  type SelectOption,
  type SelectProps,
} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanMetricsField, subregionCodeToName} from 'sentry/views/insights/types';

type Props = {
  size?: ComponentProps<typeof CompactSelect>['size'];
};

export default function SubregionSelector({size}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const hasGeoSelectorFeature = organization.features.includes('insights-region-filter');

  const value = decodeList(location.query[SpanMetricsField.USER_GEO_SUBREGION]);
  const {data, isPending} = useSpanMetrics(
    {
      fields: [SpanMetricsField.USER_GEO_SUBREGION, 'count()'],
      search: new MutableSearch('has:user.geo.subregion'),
      enabled: hasGeoSelectorFeature,
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'api.insights.user-geo-subregion-selector'
  );

  type Options = SelectProps<string>['options'];

  const options: Options =
    data?.map(row => {
      const subregionCode = row[SpanMetricsField.USER_GEO_SUBREGION];
      const text = subregionCodeToName[subregionCode] || '';
      return {
        value: subregionCode,
        label: text,
        textValue: text,
      };
    }) ?? [];

  if (!hasGeoSelectorFeature) {
    return <Fragment />;
  }

  return (
    <CompactSelect
      size={size}
      searchable
      triggerProps={{
        prefix: (
          <Fragment>
            <StyledFeatureBadge type="experimental" />
            {t('Geo region')}
          </Fragment>
        ),
      }}
      multiple
      loading={isPending}
      clearable
      value={value}
      triggerLabel={value.length === 0 ? t('All') : undefined}
      menuTitle={t('Filter region')}
      options={options}
      onChange={(selectedOptions: SelectOption<string>[]) => {
        trackAnalytics('insight.vital.select_browser_value', {
          organization,
          browsers: selectedOptions.map(v => v.value),
        });

        navigate({
          ...location,
          query: {
            ...location.query,
            [SpanMetricsField.USER_GEO_SUBREGION]: selectedOptions.map(
              option => option.value
            ),
          },
        });
      }}
    />
  );
}

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-right: ${space(1)};
`;
