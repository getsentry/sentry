import {type ComponentProps, Fragment, useEffect, useState} from 'react';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {SECOND} from 'sentry/utils/formatters';
import useProjects from 'sentry/utils/useProjects';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import type {ModuleName} from 'sentry/views/insights/types';

type Props = {
  moduleName: ModuleName;
  extraFilters?: React.ReactNode;
  onProjectChange?: ComponentProps<typeof ProjectPageFilter>['onChange'];
};

const CHANGE_PROJECT_TEXT = t('Make sure you have the correct project selected.');

export function ModulePageFilterBar({moduleName, onProjectChange, extraFilters}: Props) {
  const {projects: allProjects} = useProjects();

  const hasDataWithSelectedProjects = useHasFirstSpan(moduleName);
  const hasDataWithAllProjects = useHasFirstSpan(moduleName, allProjects);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClickAnywhereOnPage = () => {
    setShowTooltip(false);
  };

  useEffect(() => {
    if (!hasDataWithSelectedProjects && hasDataWithAllProjects) {
      const startTime = 0.5 * SECOND;
      const endTime = startTime + 5 * SECOND;
      // by adding a small delay to show the tooltip, we ensure the animation occurs and the tooltip popping up is more obvious
      setTimeout(() => setShowTooltip(true), startTime);
      setTimeout(() => setShowTooltip(false), endTime);
    }
    // We intentially do not include hasDataWithSelectedProjects in the dependencies,
    // as we only want to show the tooltip once per component load and not every time the data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDataWithAllProjects]);

  useEffect(() => {
    document.addEventListener('click', handleClickAnywhereOnPage, {capture: true});
    return () => {
      document.removeEventListener('click', handleClickAnywhereOnPage);
    };
  }, []);

  return (
    <Fragment>
      <PageFilterBar condensed>
        <Tooltip
          title={CHANGE_PROJECT_TEXT}
          forceVisible
          position="bottom-start"
          disabled={!showTooltip}
        >
          {/* TODO: Placing a DIV here is a hack, it allows the tooltip to close and the ProjectPageFilter to close at the same time,
          otherwise two clicks are required because of some rerendering/event propogation issues into the children */}
          <div style={{width: '100px', position: 'absolute', height: '100%'}} />
        </Tooltip>
        <ProjectPageFilter onChange={onProjectChange} />
        <EnvironmentPageFilter />
        <DatePageFilter />
      </PageFilterBar>
      {hasDataWithSelectedProjects && extraFilters}
    </Fragment>
  );
}
