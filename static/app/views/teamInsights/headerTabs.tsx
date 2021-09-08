import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import {t} from 'app/locale';
import {Organization} from 'app/types';

type Props = {
  organization: Organization;
  activeTab: 'projects' | 'teamInsights';
};

function HeaderTabs({organization, activeTab}: Props) {
  return (
    <Layout.HeaderNavTabs underlined>
      <li className={`${activeTab === 'projects' ? 'active' : ''}`}>
        <Link to={`/organizations/${organization.slug}/projects/`}>
          {t('Projects Overview')}
        </Link>
      </li>
      <li className={`${activeTab === 'teamInsights' ? 'active' : ''}`}>
        <Link to={`/organizations/${organization.slug}/teamInsights/`}>
          {t('Team Insights')}
        </Link>
      </li>
    </Layout.HeaderNavTabs>
  );
}

export default HeaderTabs;
