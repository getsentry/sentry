import styled from '@emotion/styled';

import Default from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/default';
import Exception from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/exception';
import {Panel} from 'sentry/components/panels';
import space from 'sentry/styles/space';
import {BreadcrumbType, BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
  orgSlug: string;
  className?: string;
}

function BaseConsole({className, breadcrumbs, orgSlug}: Props) {
  return (
    <Panel className={className}>
      {breadcrumbs.map((breadcrumb, i) => {
        return (
          <Row key={i} isLast={i === breadcrumbs.length - 1}>
            {[BreadcrumbType.WARNING, BreadcrumbType.ERROR].includes(breadcrumb.type) ? (
              <Exception breadcrumb={breadcrumb} searchTerm="" />
            ) : (
              <Default orgSlug={orgSlug} breadcrumb={breadcrumb} searchTerm="" />
            )}
          </Row>
        );
      })}
    </Panel>
  );
}

const Console = styled(BaseConsole)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.9em;
`;

const Row = styled('div')<{isLast?: boolean}>`
  ${p => (p.isLast ? '' : `border-bottom: 1px solid ${p.theme.innerBorder}`)};
  padding: ${space(0.25)} ${space(0.5)};
`;

export default Console;
