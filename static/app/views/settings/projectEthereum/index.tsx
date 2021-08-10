import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
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
      ethAddresses: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['ethAddresses', this.baseUrl],
    ];

    return endpoints;
  }

  get baseUrl() {
    const {orgId, projectId} = this.props.params;

    return `/projects/${orgId}/${projectId}/ethereum-addresses/`;
  }

  handleOpenAddDialog = () => {
    return openModal(modalProps => (
      <AddressModal
        {...modalProps}
        api={this.api}
        baseUrl={this.baseUrl}
        address={undefined}
        onSubmitSuccess={() => this.remountComponent()}
      />
    ));
  };

  handleOpenEditDialog = () => {
    // console.log('handleOpenEditDialog');
  };

  handleDeleteAddress = async (id: string) => {
    try {
      await this.api.requestPromise(`${this.baseUrl}/${id}/`, {
        method: 'DELETE',
      });

      addSuccessMessage(t('Address deleted successfully.'));
      this.remountComponent();
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Unable to delete address.'));
    }
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
