import {useMemo} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import {groupedErrors} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {useActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {FoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type Props = {
  event: Event;
  project: Project;
};

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

function EventErrorDescription({errorList}) {
  const firstError = errorList[0];
  const {title, desc} = firstError;
  const numErrors = errorList.length;
  const errorDataList = errorList.map(error => error.data ?? {});

  const cleanedData = useMemo(() => {
    const cleaned = errorDataList.map(errorData => {
      const data = {...errorData};

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
          subject: keyMapping[key] || startCase(key),
        }))
        .filter(d => {
          if (!d.value) {
            return true;
          }
          return !!d.value;
        });
    });
    return cleaned;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorDataList]);

  return (
    <div>
      <ErrorTitleFlex>
        <strong>
          {title} ({numErrors})
        </strong>
      </ErrorTitleFlex>
      <div>
        {desc && <Description>{desc}</Description>}
        {cleanedData.map((data, idx) => {
          return (
            <div key={idx}>
              <KeyValueList data={data} isContextData />
              {idx !== numErrors - 1 && <hr />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EventActionableItems({event, project}: Props) {
  const organization = useOrganization();
  const {data: actionableItems} = useActionableItems({
    eventId: event.id,
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  if (!actionableItems) {
    return null;
  }

  const errorMessages = groupedErrors(event, actionableItems, []);

  return (
    <InterimSection
      title={t('Event Processing Errors')}
      type={FoldSectionKey.PROCESSING_ERROR}
    >
      {Object.keys(errorMessages).map((error, idx) => {
        return <EventErrorDescription key={idx} errorList={errorMessages[error]} />;
      })}
    </InterimSection>
  );
}

const ErrorTitleFlex = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
`;

const Description = styled('div')`
  margin-top: ${space(0.5)};
`;
