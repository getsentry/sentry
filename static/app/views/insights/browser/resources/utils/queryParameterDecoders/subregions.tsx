import {decodeList} from 'sentry/utils/queryString';
import {type SubregionCode, subregionCodeToName} from 'sentry/views/insights/types';

const OPTIONS = Object.keys(subregionCodeToName) as SubregionCode[];

export default function decode(
  value: string | string[] | undefined | null
): SubregionCode[] | undefined {
  const decodedValue = decodeList(value);

  // return decodedValue.filter(isAValidOption);
  const validSubregions = decodedValue.filter(isAValidOption);
  return validSubregions.length > 0 ? validSubregions : undefined;
}

function isAValidOption(maybeOption: string): maybeOption is SubregionCode {
  // Manually widen to allow the comparison to string
  return (OPTIONS as unknown as string[]).includes(maybeOption as SubregionCode);
}
