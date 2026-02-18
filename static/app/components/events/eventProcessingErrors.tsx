import {useMemo} from 'react';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import type {ErrorMessage} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {useActionableItemsWithProguardErrors} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import {KeyValueData} from 'sentry/components/keyValueData';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
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

export const DOCS_URLS: Record<string, string> = {
  release: 'https://docs.sentry.io/cli/releases/#creating-releases',
  environment:
    'https://docs.sentry.io/concepts/key-terms/environments/#environment-naming-requirements',
};

function EventErrorCard({
  title,
  data,
}: {
  data: Array<{key: string; subject: any; value: any}>;
  title: string;
}) {
  const contentItems = data.map(datum => {
    return {item: datum};
  });

  // Find the first item that has a corresponding documentation URL
  const docLink = data
    .map(d => {
      const value = String(d.value || '').toLowerCase();
      return DOCS_URLS[value];
    })
    .find(Boolean);

  const titleElement = docLink ? (
    <Flex gap="md" align="center">
      {title}
      <QuestionTooltip
        title={tct('Learn more about this error in our [docLink:documentation]', {
          docLink: <ExternalLink href={docLink} />,
        })}
        size="sm"
        position="top"
        isHoverable
      />
    </Flex>
  ) : (
    <div>{title}</div>
  );

  return <KeyValueData.Card contentItems={contentItems} title={titleElement} />;
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
  const errors = useActionableItemsWithProguardErrors({event, project, isShare});

  if (!errors || errors.length === 0) {
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
