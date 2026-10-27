import {renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openMainBinaryExportedSymbolsModal} from './mainBinaryExportedSymbolsModal';

describe('openMainBinaryExportedSymbolsModal', () => {
  it('warns against exporting _NSExtensionMain when an app extension is flagged', async () => {
    renderGlobalModal();
    openMainBinaryExportedSymbolsModal([
      'MyApp',
      'PlugIns/ShareExtension.appex/ShareExtension',
    ]);

    expect(await screen.findByRole('dialog')).toHaveTextContent('ITMS-90898');
    expect(screen.getByText('_NSExtensionMain')).toBeInTheDocument();
  });

  it('omits the app extension warning when only the main app is flagged', async () => {
    renderGlobalModal();
    openMainBinaryExportedSymbolsModal(['MyApp']);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('_NSExtensionMain')).not.toBeInTheDocument();
  });
});
