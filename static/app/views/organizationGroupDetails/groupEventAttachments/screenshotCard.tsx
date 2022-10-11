import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import DateTime from 'sentry/components/dateTime';
import Screenshot from 'sentry/components/events/eventTagsAndScreenshot/screenshot';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {IssueAttachment, Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  eventAttachment: IssueAttachment;
  eventId: string;
  projectSlug: Project['slug'];
};

export function ScreenshotCard({eventAttachment, projectSlug, eventId}: Props) {
  const organization = useOrganization();
  if (eventAttachment) {
    return (
      <Card interactive>
        <CardHeader>
          <Title>{eventAttachment.sha1}</Title>
          <Detail>
            <DateTime date={eventAttachment.dateCreated} />
          </Detail>
        </CardHeader>
        <CardBody>
          <Screenshot
            screenshot={eventAttachment}
            organization={organization}
            projectSlug={projectSlug}
            eventId={eventId}
            onDelete={() => {}}
            openVisualizationModal={() => {}}
            hideFooter
          />
        </CardBody>
        <CardFooter>{t('screenshot.png')}</CardFooter>
      </Card>
    );
  }
  return null;
}

const Title = styled('div')`
  ${p => p.theme.overflowEllipsis};
  font-weight: normal;
`;

const Detail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  ${p => p.theme.overflowEllipsis};
  line-height: 1.5;
`;

const CardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const CardBody = styled('div')`
  background: ${p => p.theme.gray100};
  padding: ${space(1.5)} ${space(2)};
  max-height: 150px;
  min-height: 150px;
  overflow: hidden;
  border-bottom: 1px solid ${p => p.theme.gray100};
`;

const CardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;
