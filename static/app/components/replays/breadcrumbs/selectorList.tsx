import {Fragment} from 'react';

import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {ClickFrame} from 'sentry/utils/replays/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export default function SelectorList({frame}: {frame: ClickFrame}) {
  const location = useLocation();
  const organization = useOrganization();

  const componentName = frame.data.node?.attributes['data-sentry-component'];
  const indexOfArrow = frame.message?.lastIndexOf('>') ?? -1;
  const lastComponentIndex = indexOfArrow === -1 ? 0 : indexOfArrow + 2;

  return componentName ? (
    <Fragment>
      <span>{frame.message?.substring(0, lastComponentIndex)}</span>
      <Tooltip
        title={t('Search by this component')}
        containerDisplayMode="inline"
        isHoverable
      >
        <Link
          to={{
            pathname: makeReplaysPathname({
              path: '/',
              organization,
            }),
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
