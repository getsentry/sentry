// import {useEffect} from 'react';

// import {trackAnalytics} from 'sentry/utils/analytics';
// import useOrganization from 'sentry/utils/useOrganization';
// import usePageFilters from 'sentry/utils/usePageFilters';
// import {
//   type DomainView,
//   useDomainViewFilters,
// } from 'sentry/views/insights/pages/useFilters';

// export function useOverviewPageTrackAnalytics(domain: DomainView) {
//   const organization = useOrganization();
//   const pageFilters = usePageFilters();
//   const view = useDomainViewFilters();

//   const analyticEventName = `insights.overview.pageload`;

//   const selectedProjects = pageFilters.selection.projects;
//   useEffect(() => {
//     if (pageFilters.isReady) {
//       trackAnalytics(analyticEventName, {
//         organization,
//         sdks: pageFilters.selection.projects,
//         domain,
//       });
//     }
//   }, [organization, selectedProjects, pageFilters.isReady, view]);
// }
