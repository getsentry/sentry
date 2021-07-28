import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import Buttonbar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import {getRelativeTimeFromEventDateCreated} from 'app/components/events/contexts/utils';
import NotAvailable from 'app/components/notAvailable';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {EventAttachment, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import getDynamicText from 'app/utils/getDynamicText';

import ImageVisualization from './imageVisualization';

type Props = ModalRenderProps & {
  eventAttachment: EventAttachment;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  event: Event;
  onDelete: () => void;
  downloadUrl: string;
};

function Modal({
  eventAttachment,
  orgSlug,
  projectSlug,
  Header,
  Body,
  Footer,
  event,
  onDelete,
  downloadUrl,
}: Props) {
  const {dateCreated, name, size, mimetype, type} = eventAttachment;
  return (
    <Fragment>
      <Header closeButton>
        <Title>
          {t('Screenshot')}
          <FileName>
            {name ? name.split(`.${name.split('.').pop()}`)[0] : t('Unknown')}
          </FileName>
        </Title>
      </Header>
      <Body>
        <GeralInfo>
          <Label coloredBg>{t('Date Created')}</Label>
          <Value coloredBg>
            {dateCreated ? (
              <Fragment>
                <DateTime
                  date={getDynamicText({
                    value: dateCreated,
                    fixed: new Date(1508208080000),
                  })}
                />
                {getRelativeTimeFromEventDateCreated(
                  event.dateCreated,
                  dateCreated,
                  false
                )}
              </Fragment>
            ) : (
              <NotAvailable />
            )}
          </Value>

          <Label>{t('Name')}</Label>
          <Value>{name ?? <NotAvailable />}</Value>

          <Label coloredBg>{t('Size')}</Label>
          <Value coloredBg>{size ?? <NotAvailable />}</Value>

          <Label>{t('Mimetype')}</Label>
          <Value>{mimetype ?? <NotAvailable />}</Value>

          <Label coloredBg>{t('Type')}</Label>
          <Value coloredBg>{type ?? <NotAvailable />}</Value>
        </GeralInfo>

        <StyledImageVisualization
          attachment={eventAttachment}
          orgId={orgSlug}
          projectId={projectSlug}
          event={event}
        />
      </Body>
      <Footer>
        <Buttonbar gap={1}>
          <Confirm
            confirmText={t('Delete')}
            header={t(
              'Screenshots help identify what the user saw when the event happened'
            )}
            message={t('Are you sure you wish to delete this screenshot?')}
            priority="danger"
            onConfirm={onDelete}
          >
            <Button priority="danger">{t('Delete')}</Button>
          </Confirm>
          <Button href={downloadUrl}>{t('Download')}</Button>
        </Buttonbar>
      </Footer>
    </Fragment>
  );
}

export default Modal;

const Title = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  max-width: calc(100% - 40px);
  word-break: break-all;
`;

const FileName = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
`;

const GeralInfo = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(3)};
`;

const Label = styled('div')<{coloredBg?: boolean}>`
  color: ${p => p.theme.textColor};
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(1)};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
`;

const Value = styled(Label)`
  white-space: pre-wrap;
  word-break: break-all;
  color: ${p => p.theme.subText};
  padding: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
`;

const StyledImageVisualization = styled(ImageVisualization)`
  img {
    border-radius: ${p => p.theme.borderRadius};
  }
`;

export const modalCss = css`
  width: auto;
  height: 100%;
  max-width: 100%;
`;
