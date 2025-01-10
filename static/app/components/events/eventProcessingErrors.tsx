import {useMemo} from 'react';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import type {ErrorMessage} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {getErrorMessage} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {
  shouldErrorBeShown,
  useFetchProguardMappingFiles,
} from 'sentry/components/events/interfaces/crashContent/exception/actionableItemsUtils';
import {useActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import KeyValueData from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type Props = {
  event: Event;
  isShare: boolean;
  project: Project;
};

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

export default function EventErrorCard({
  title,
  data,
}: {
  data: {key: string; subject: any; value: any}[];
  title: string;
}) {
  const contentItems = data.map(datum => {
    return {item: datum};
  });
  return <KeyValueData.Card contentItems={contentItems} title={<div>{title}</div>} />;
}

function EventErrorDescription({error}: {error: ErrorMessage}) {
  const {title, data: errorData} = error;

  const cleanedData = useMemo(() => {
    const data = errorData || {};
    if (data.message === 'None') {
      // Python ensures a message string, but "None" doesn't make sense here
      delete data.message;
    }

    if (typeof data.image_path === 'string') {
      // Separate the image name for readability
      const separator = /^([a-z]:\\|\\\\)/i.test(data.image_path) ? '\\' : '/';
      const path = data.image_path.split(separator);
      data.image_name = path.splice(-1, 1)[0];
      data.image_path = path.length ? path.join(separator) + separator : '';
    }

    if (typeof data.server_time === 'string' && typeof data.sdk_time === 'string') {
      data.message = t(
        'Adjusted timestamps by %s',
        moment
          .duration(moment.utc(data.server_time).diff(moment.utc(data.sdk_time)))
          .humanize()
      );
    }

    return Object.entries(data)
      .map(([key, value]) => ({
        key,
        value,
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        subject: keyMapping[key] || startCase(key),
      }))
      .filter(d => {
        if (!d.value) {
          return true;
        }
        return !!d.value;
      });
  }, [errorData]);

  return <EventErrorCard title={title} data={cleanedData} />;
}

export function EventProcessingErrors({event, project, isShare}: Props) {
  const organization = useOrganization();
  const {data: actionableItems} = useActionableItems({
    eventId: event.id,
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const {proguardErrors} = useFetchProguardMappingFiles({
    event,
    project,
    isShare,
  });

  if (!actionableItems || actionableItems.errors.length === 0 || !proguardErrors) {
    return null;
  }

  const {_meta} = event;
  const errors = [...actionableItems.errors, ...proguardErrors]
    .filter(error => shouldErrorBeShown(error, event))
    .flatMap((error, errorIdx) =>
      getErrorMessage(error, _meta?.errors?.[errorIdx]).map(message => ({
        ...message,
        type: error.type,
      }))
    );

  if (!errors.length) {
    return null;
  }

  return (
    <InterimSection
      title={t('Event Processing Errors')}
      type={SectionKey.PROCESSING_ERROR}
    >
      <KeyValueData.Container>
        {errors.map((error, idx) => {
          return <EventErrorDescription key={idx} error={error} />;
        })}
      </KeyValueData.Container>
    </InterimSection>
  );
}
