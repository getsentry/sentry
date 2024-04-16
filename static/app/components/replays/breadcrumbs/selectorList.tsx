import {Fragment} from 'react';

import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {ClickFrame} from 'sentry/utils/replays/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

export default function SelectorList({frame}: {frame: ClickFrame}) {
  const location = useLocation();
  const organization = useOrganization();

  const componentName = frame.data.node?.attributes['data-sentry-component'];

  // Guard against experimental frames for mobile replays
  // TODO: can probably remove this check when mobile replay frames are
  // more complete
  const lastComponentIndex =
    'message' in frame
      ? frame.message?.lastIndexOf('>') === -1
        ? 0
        : frame.message?.lastIndexOf('>') + 2
      : 0;

  return componentName ? (
    <Fragment>
      <span>{frame.message.substring(0, lastComponentIndex)}</span>
      <Tooltip title={t('Search by this component')} isHoverable>
        <Link
          to={{
            pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
            query: {
              ...location.query,
              query: `click.component_name:${componentName}`,
            },
          }}
        >
          {componentName}
        </Link>
      </Tooltip>
    </Fragment>
  ) : (
    frame.message
  );
}
