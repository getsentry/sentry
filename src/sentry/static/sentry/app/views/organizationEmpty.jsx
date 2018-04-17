import {Link} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../locale';
import AsyncView from './asyncView';
import ConfigStore from '../stores/configStore';
import NarrowLayout from '../components/narrowLayout';
import space from '../styles/space';
import withOrganizations from '../utils/withOrganizations';

class OrganizationEmpty extends AsyncView {
  getEndpoints() {
    return [['organizations', '/organizations/']];
  }

  getTitle() {
    return 'No Organizations';
  }

  renderBody() {
    let {organizations} = this.state;
    let features = ConfigStore.get('features');
    let canCreateOrg = features.has('organizations:create');
    let pendingDeleteOrganizations = organizations.filter(
      ({status}) => status.id === 'pending_deletion'
    );

    return (
      <NarrowLayout>
        <h3>{t('No Organizations')}</h3>

        <p>
          {t(
            'You are not a member of any active organizations, your team may need to invite you to an existing organization. '
          )}
        </p>

        <LinksWrapper>
          <LinksChild>
            <h5>{t('Quick Links')}</h5>
            <ul>
              {canCreateOrg && (
                <li>
                  <Link to="/organizations/new/">{t('Create new organization')}</Link>
                </li>
              )}
              <li>
                <a href="/account/settings/">{t('Account Settings')}</a>
              </li>
              <li>
                <a href="/auth/logout/">{t('Logout')}</a>
              </li>
            </ul>
          </LinksChild>
          {!!pendingDeleteOrganizations.length && (
            <LinksChild>
              <h5>{t('Organizations Pending Delete')}</h5>
              <p>
                {t(
                  'Below are organizations that will be deleted. Follow the links to restore an organization.'
                )}
              </p>
              <ul>
                {pendingDeleteOrganizations.map(org => (
                  <li key={org.slug}>
                    <Link to={`/${org.slug}/`}>{org.slug}</Link>
                  </li>
                ))}
              </ul>
            </LinksChild>
          )}
        </LinksWrapper>
      </NarrowLayout>
    );
  }
}

export {OrganizationEmpty};
export default withOrganizations(OrganizationEmpty);

const LinksWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const LinksChild = styled('div')`
  flex: 1;
  border-right: 1px solid ${p => p.theme && p.theme.borderLight};
  padding: 0 ${space(2)};

  &:last-child {
    border-right: none;
  }
`;
