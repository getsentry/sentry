import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useParams} from 'sentry/utils/useParams';

import BeaconCheckins from 'admin/components/beacons/beaconCheckins';
import type {BeaconData} from 'admin/components/beacons/beaconOverview';
import BeaconOverview from 'admin/components/beacons/beaconOverview';
import RelatedBeacons from 'admin/components/beacons/relatedBeacons';
import DetailsPage from 'admin/components/detailsPage';

export default function BeaconDetails() {
  const params = useParams<{beaconId: string}>();
  const {data, isPending, isError} = useApiQuery<BeaconData>(
    [`/beacons/${params.beaconId}/`],
    {
      staleTime: 0,
    }
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
