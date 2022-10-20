import {Fragment, useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import {revertToPinnedFilters} from 'sentry/actionCreators/pageFilters';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PinnedPageFilter} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  router: InjectedRouter;
  hideRevertButton?: boolean;
  message?: string;
};

const filterNameMap: Record<PinnedPageFilter, string> = {
  projects: t('project'),
  environments: t('environment'),
  datetime: t('date'),
};

function getReadableDesyncedFilterList(desyncedFilters: Set<PinnedPageFilter>) {
  const filters = [...desyncedFilters];

  if (filters.length === 1) {
    return `${filterNameMap[filters[0]]} filter`;
  }

  return `${filters
    .slice(0, -1)
    .map(value => filterNameMap[value])
    .join(', ')} and ${filterNameMap[filters[filters.length - 1]]} filters`;
}

export default function DesyncedFilterAlert({
  router,
  message,
  hideRevertButton = false,
}: Props) {
  const {desyncedFilters} = usePageFilters();
  const organization = useOrganization();
  const [hideAlert, setHideAlert] = useState(false);

  const onRevertClick = () => {
    revertToPinnedFilters(organization.slug, router);
  };

  if (desyncedFilters.size === 0 || hideAlert) {
    return null;
  }

  return (
    <DesyncedAlert
      type="info"
      showIcon
      system
      trailingItems={
        <Fragment>
          {!hideRevertButton && (
            <RevertButton priority="link" size="zero" onClick={onRevertClick} borderless>
              {t('Restore old values')}
            </RevertButton>
          )}
          <Button
            priority="link"
            size="zero"
            icon={<IconClose color="purple300" />}
            aria-label={t('Close Alert')}
            onClick={() => setHideAlert(true)}
          />
        </Fragment>
      }
    >
      {message ??
        tct(
          'The [filter] [has] been overwritten. This can happen when you open sentry.io links with filter parameters that are different from your current filter values.',
          {
            filter: getReadableDesyncedFilterList(desyncedFilters),
            has: desyncedFilters.size > 1 ? t('have') : t('has'),
          }
        )}
    </DesyncedAlert>
  );
}

const DesyncedAlert = styled(Alert)`
  margin-bottom: 0;
`;

const RevertButton = styled(Button)`
  display: flex;
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.purple300};

  &:after {
    content: '|';
    margin-left: ${space(2)};
    color: ${p => p.theme.purple200};
  }
`;
