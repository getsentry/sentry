import type {ComponentProps} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {
  CompactSelect,
  type SelectOption,
  type SelectProps,
} from 'sentry/components/core/compactSelect';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanFields, subregionCodeToName} from 'sentry/views/insights/types';

type Props = {
  size?: ComponentProps<typeof CompactSelect>['size'];
};

export default function SubregionSelector({size}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const value = decodeList(location.query[SpanFields.USER_GEO_SUBREGION]);
  const {data, isPending} = useSpans(
    {
      fields: [SpanFields.USER_GEO_SUBREGION, 'count()'],
      search: new MutableSearch('has:user.geo.subregion'),
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'api.insights.user-geo-subregion-selector'
  );

  type Options = SelectProps<string>['options'];

  const options: Options =
    data?.map(row => {
      const subregionCode = row[SpanFields.USER_GEO_SUBREGION];
      const text = subregionCodeToName[subregionCode] || '';
      return {
        value: subregionCode,
        label: text,
        textValue: text,
      };
    }) ?? [];

  const tooltip = t('These correspond to the subregions of the UN M49 standard.');

  return (
    <CompactSelect
      size={size}
      searchable
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Geo region')}>
          {value.length === 0 ? t('All') : triggerProps.children}
        </OverlayTrigger.Button>
      )}
      multiple
      loading={isPending}
      clearable
      value={value}
      menuTitle={
        <Flex align="center" gap="xs">
          {t('Filter region')}
          <QuestionTooltip title={tooltip} size="xs" />
        </Flex>
      }
      options={options}
      onChange={(selectedOptions: Array<SelectOption<string>>) => {
        trackAnalytics('insight.general.select_region_value', {
          organization,
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          regions: selectedOptions.map(v => subregionCodeToName[v.value]),
        });

        navigate({
          ...location,
          query: {
            ...location.query,
            [SpanFields.USER_GEO_SUBREGION]: selectedOptions.map(option => option.value),
          },
        });
      }}
    />
  );
}
