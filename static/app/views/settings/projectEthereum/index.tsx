import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import ExternalLink from 'app/components/links/externalLink';
import NotAvailable from 'app/components/notAvailable';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import TextOverflow from 'app/components/textOverflow';
import {IconAdd, IconDelete, IconEdit} from 'app/icons';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';

import SettingsPageHeader from '../components/settingsPageHeader';
import TextBlock from '../components/text/textBlock';

import AddressModal from './addressModal';

export type EthAddress = {
  id: string;
  address: string;
  dateUpdated: string;
  displayName?: string;
  abi?: string;
};

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  ethAddresses: EthAddress[];
};

class ProjectEthereum extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Ethereum Smart Contracts'), projectId, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      ethAddresses: [
        {
          id: 1,
          address: '0x0314d69c14328bed45a45f96a75400f733164e13',
          dateUpdated: '2020-10-02T10:19:05.350431Z',
          displayName: "Matej's Contract",
          abi: 'test',
        },
      ],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    const {orgId, projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['ethAddresses', `/projects/${orgId}/${projectId}/ethereum-addresses/`],
    ];

    return endpoints;
  }

  handleOpenAddDialog = () => {
    const {organization, project} = this.props;
    return openModal(modalProps => (
      <AddressModal
        {...modalProps}
        api={this.api}
        organization={organization}
        project={project}
        address={undefined}
        onSubmitSuccess={() => this.remountComponent()}
      />
    ));
  };

  handleOpenEditDialog = () => {
    // console.log('handleOpenEditDialog');
  };

  handleDeleteAddress = (_id: string) => {
    // console.log('handleDeleteAddress');
  };

  renderAddresses() {
    const {ethAddresses} = this.state;
    return ethAddresses.map(({displayName, address, dateUpdated, id}) => (
      <Fragment key={id}>
        <Column>{displayName || <NotAvailable />}</Column>
        <Column>
          <TextOverflow>0x{address}</TextOverflow>
        </Column>
        <Column>
          <DateTime date={dateUpdated} />
        </Column>
        <ActionsColumn>
          <ButtonBar gap={0.5}>
            <Button
              size="small"
              icon={<IconEdit />}
              title={t('Edit Address')}
              label={t('Edit Address')}
              onClick={this.handleOpenEditDialog}
            />
            <Confirm
              onConfirm={() => this.handleDeleteAddress(id)}
              message={t(
                'Are you sure you want to remove all artifacts in this archive?'
              )}
            >
              <Button
                size="small"
                icon={<IconDelete />}
                title={t('Remove Address')}
                label={t('Remove Address')}
              />
            </Confirm>
          </ButtonBar>
        </ActionsColumn>
      </Fragment>
    ));
  }

  renderBody() {
    const {loading, ethAddresses, ethAddressesPageLinks} = this.state;

    return (
      <Fragment>
        <SettingsPageHeader
          title={t('Ethereum Smart Contracts')}
          action={
            <Button
              priority="primary"
              size="small"
              icon={<IconAdd size="xs" isCircled />}
              onClick={this.handleOpenAddDialog}
            >
              {t('Register Address')}
            </Button>
          }
        />

        <TextBlock>
          {tct(
            `A smart contract is a program that resides at a specific address on the Ethereum blockchain. By registering address, you tell Sentry where to look for errors. To learn more about Ethereum smart contracts, [link: read the docs].`,
            {
              link: <ExternalLink href="https://docs.sentry.io/" />,
            }
          )}
        </TextBlock>

        <PanelTable
          headers={[t('Name'), t('Address'), t('Date Updated'), '']}
          emptyMessage={t('There are no addresses for this project.')}
          isEmpty={ethAddresses.length === 0}
          isLoading={loading}
        >
          {this.renderAddresses()}
        </PanelTable>
        <Pagination pageLinks={ethAddressesPageLinks} />
      </Fragment>
    );
  }
}

const Column = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;

export default ProjectEthereum;
