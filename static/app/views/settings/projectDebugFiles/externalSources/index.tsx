import {Client} from 'app/api';
import {Item as ListItem} from 'app/components/dropdownAutoComplete/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource} from 'app/types/debugFiles';

import BuildInSymbolSources from './buildInSymbolSources';
import SymbolSources from './symbolSources';

type Props = {
  api: Client;
  organization: Organization;
  projectSlug: Project['slug'];
  builtinSymbolSources: BuiltinSymbolSource[];
  symbolSources: ListItem[];
};

function ExternalSources({
  api,
  organization,
  symbolSources,
  builtinSymbolSources,
  projectSlug,
}: Props) {
  return (
    <Panel>
      <PanelHeader>{t('External Sources')}</PanelHeader>
      <PanelBody>
        <SymbolSources
          api={api}
          organization={organization}
          symbolSources={symbolSources}
          projectSlug={projectSlug}
        />
        <BuildInSymbolSources
          api={api}
          organization={organization}
          builtinSymbolSources={builtinSymbolSources}
          projectSlug={projectSlug}
        />
      </PanelBody>
    </Panel>
  );
}

export default ExternalSources;
