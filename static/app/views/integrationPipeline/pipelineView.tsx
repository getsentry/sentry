import {useEffect} from 'react';

import Indicators from 'sentry/components/indicators';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';

import AwsLambdaCloudformation from './awsLambdaCloudformation';
import AwsLambdaFailureDetails from './awsLambdaFailureDetails';
import AwsLambdaFunctionSelect from './awsLambdaFunctionSelect';
import AwsLambdaProjectSelect from './awsLambdaProjectSelect';

const pipelineMapper: Record<string, [React.ComponentType<any>, string]> = {
  awsLambdaProjectSelect: [AwsLambdaProjectSelect, 'AWS Lambda Select Project'],
  awsLambdaFunctionSelect: [AwsLambdaFunctionSelect, 'AWS Lambda Select Lambdas'],
  awsLambdaCloudformation: [AwsLambdaCloudformation, 'AWS Lambda Create Cloudformation'],
  awsLambdaFailureDetails: [AwsLambdaFailureDetails, 'AWS Lambda View Failures'],
};

type Props = {
  [key: string]: any;
  pipelineName: string;
};

/**
 * This component is a wrapper for specific pipeline views for integrations
 */
function PipelineView({pipelineName, ...props}: Props) {
  const mapping = pipelineMapper[pipelineName];

  if (!mapping) {
    throw new Error(`Invalid pipeline name ${pipelineName}`);
  }

  const [Component, title] = mapping;

  // Set the page title
  useEffect(() => void (document.title = title), [title]);

  return (
    <ThemeAndStyleProvider>
      <Indicators className="indicators-container" />
      <Component {...props} />
    </ThemeAndStyleProvider>
  );
}

export default PipelineView;
