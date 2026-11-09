import {useQuery} from '@tanstack/react-query';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useParams} from 'sentry/utils/useParams';

import {BeaconCheckins} from 'admin/components/beacons/beaconCheckins';
import type {BeaconData} from 'admin/components/beacons/beaconOverview';
import {BeaconOverview} from 'admin/components/beacons/beaconOverview';
import {RelatedBeacons} from 'admin/components/beacons/relatedBeacons';
import {DetailsPage} from 'admin/components/detailsPage';

export function BeaconDetails() {
  const params = useParams<{beaconId: string}>();
  const {data, isPending, isError} = useQuery(
    apiOptions.as<BeaconData>()('/beacons/$beaconId/', {
      path: {beaconId: params.beaconId},
      staleTime: 0,
    })
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  const sectionProps = {
    ...params,
    data,
  };

  return (
    <DetailsPage
      rootName="Beacons"
      name={data.installID}
      sections={[
        {
          content: <BeaconOverview {...sectionProps} />,
        },
        {
          name: 'Similar Installs',
          content: <RelatedBeacons {...sectionProps} />,
          noPanel: true,
        },
        {
          name: 'Checkins',
          noPanel: true,
          content: <BeaconCheckins {...sectionProps} />,
        },
      ]}
    />
  );
}
