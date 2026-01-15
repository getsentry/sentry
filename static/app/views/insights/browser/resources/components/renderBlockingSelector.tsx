import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {SpanFields} from 'sentry/views/insights/types';

const {RESOURCE_RENDER_BLOCKING_STATUS} = SpanFields;

function RenderBlockingSelector({value}: {value?: string}) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const options = [
    {value: '', label: 'All'},
    {value: 'non-blocking', label: t('No')},
    {value: 'blocking', label: t('Yes')},
  ];

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Blocking')} />
      )}
      options={options}
      value={value ?? ''}
      onChange={newValue => {
        trackAnalytics('insight.asset.filter_by_blocking', {
          organization,
          filter: newValue?.value,
        });
        navigate({
          ...location,
          query: {
            ...location.query,
            [RESOURCE_RENDER_BLOCKING_STATUS]: newValue?.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}

export default RenderBlockingSelector;
