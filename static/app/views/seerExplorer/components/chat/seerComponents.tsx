// Importing each embed module runs its `SeerComponentRegistry.register(...)`
// call, wiring the markdown tag name to its renderer. Register new Seer embed
// components by adding their import here.
import 'sentry/views/seerExplorer/components/chat/docsLink';

export {SeerComponentRegistry} from 'sentry/views/seerExplorer/components/chat/seerComponentRegistry';
