import {useEffect} from 'react';
import {Location} from 'history';

import {handleTraceDetailsRouting} from 'sentry/components/events/interfaces/spans/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Event, Organization} from 'sentry/types';
import {TraceMetaQueryChildrenProps} from 'sentry/utils/performance/quickTrace/traceMetaQuery';

type Props = {
    children: JSX.Element;
    event: Event;
    location: Location;
    metaResults: TraceMetaQueryChildrenProps | undefined;
    organization: Organization;
}

function TraceDetailsRouting(props: Props) {
    const {metaResults, location, organization, event, children} = props;

    useEffect(() => {
        handleTraceDetailsRouting(
            metaResults,
            event,
            organization,
            location
          );
    }, [event, metaResults, location , organization]);


    if(!organization.features.includes('performance-trace-details')){
        return children;
    }

    if (metaResults?.isLoading &&
      organization.features.includes('performance-trace-details')
    ) {
      return <LoadingIndicator />;
    }

  return children;
}

export default TraceDetailsRouting;
