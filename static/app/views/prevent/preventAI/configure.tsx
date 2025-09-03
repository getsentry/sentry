import {FeatureOverview} from './onboarding';
import {PreventAIToolbar} from './toolbar';

function PreventAIMainPanel() {
  return (
    <div>
      <div>PreventAIMainPanel</div>
      <FeatureOverview />
    </div>
  );
}

export default function PreventAIConfig() {
  return (
    <div>
      <div>PreventAIConfig</div>
      <PreventAIToolbar />
      <PreventAIMainPanel />
    </div>
  );
}
