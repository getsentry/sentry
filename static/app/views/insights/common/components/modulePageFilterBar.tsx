import {Fragment, useEffect, useState} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {SECOND} from 'sentry/utils/formatters';
import useProjects from 'sentry/utils/useProjects';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import {InsightsModuleDatePageFilter} from 'sentry/views/insights/common/components/insightsModuleDatePageFilter';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import type {ModuleName} from 'sentry/views/insights/types';

type Props = {
  moduleName: ModuleName;
  disableProjectFilter?: boolean; // This is used primarily for module summary pages when a project can't be selected
  extraFilters?: React.ReactNode;
};

const CHANGE_PROJECT_TEXT = t('Make sure you have the correct project selected.');

export function ModulePageFilterBar({
  moduleName,
  extraFilters,
  disableProjectFilter,
}: Props) {
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
      // by adding a small delay to show the tooltip, this ensures the animation occurs and the tooltip popping up is more obvious
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
      <Tooltip
        title={CHANGE_PROJECT_TEXT}
        forceVisible
        position="bottom-start"
        disabled={!showTooltip}
      >
        {/* TODO: Placing a DIV here is a hack, it allows the tooltip to close and the ProjectPageFilter to close at the same time,
          otherwise two clicks are required because of some rerendering/event propogation issues into the children */}
        <div
          style={{
            position: 'absolute',
            width: '100px',
            height: '36px' /* default button height */,
          }}
        />
      </Tooltip>
      {/* Requires an extra div, else the pagefilterbar will grow to fill the height
      of the readout ribbon which results in buttons being very large. */}
      <div>
        <PageFilterBar condensed>
          {!disableProjectFilter && <InsightsProjectSelector />}
          <InsightsEnvironmentSelector />
          <InsightsModuleDatePageFilter />
        </PageFilterBar>
      </div>
      {hasDataWithSelectedProjects && extraFilters}
    </Fragment>
  );
}
