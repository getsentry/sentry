import {Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import ExternalLink from 'app/components/links/externalLink';
import {IconClose} from 'app/icons/iconClose';
import {t} from 'app/locale';
import space from 'app/styles/space';

import Status from './status';

// https://docs.github.com/en/rest/reference/pulls
type GitActivity = React.ComponentProps<typeof Status> & {
  id: string;
  url: string;
  title: string;
  onUnlink: (id: string) => Promise<void>;
};

function Activity({id, url, title, state, merged, draft, onUnlink}: GitActivity) {
  return (
    <Fragment>
      <StatusColumn>
        <Status state={state} merged={merged} draft={draft} />
      </StatusColumn>
      <Column>
        <ExternalLink href={url}>{title}</ExternalLink>
      </Column>
      <ActionColumn>
        <Confirm
          onConfirm={() => onUnlink(id)}
          message={t('Are you sure you want to unlink this Pull Request from the issue?')}
        >
          <StyledButton
            size="zero"
            icon={<IconClose size="xs" />}
            title={t('Unlink Pull Request')}
            label={t('Unlink Pull Request')}
            borderless
          />
        </Confirm>
      </ActionColumn>
    </Fragment>
  );
}

export default Activity;

const Column = styled('div')`
  padding: ${space(1)} 0;
  height: 100%;
  line-height: 20px;
`;

const StatusColumn = styled(Column)`
  padding-right: ${space(1.5)};
  padding-left: ${space(0.5)};
`;

const ActionColumn = styled(Column)`
  padding-left: ${space(1.5)};
  padding-right: ${space(0.5)};
`;

const StyledButton = styled(Button)`
  height: 20px;
  width: 16px;
`;
