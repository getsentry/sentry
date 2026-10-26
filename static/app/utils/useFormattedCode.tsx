import {useMemo} from 'react';
import {queryOptions, skipToken, useQuery} from '@tanstack/react-query';
import type jsBeautify from 'js-beautify';

type FormatterLanguage = 'html' | 'javascript';
type FormatterOptions = jsBeautify.HTMLBeautifyOptions | jsBeautify.JSBeautifyOptions;

interface UseFormattedCodeOptions {
  code: string;
  language: FormatterLanguage | null;
  options?: FormatterOptions;
}

/**
 * `js-beautify` is roughly 25 KiB gzip. Keep the public package entry point behind
 * one named dynamic import so consumers do not download it until formatting is needed
 * and Rspack emits a recognizable `js-beautify.<contenthash>.js` chunk.
 */
async function loadBeautifier() {
  const {default: beautify} = await import(
    /* rspackChunkName: "js-beautify" */ 'js-beautify'
  );
  return beautify;
}

function beautifierQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: ['js-beautify'],
    queryFn: enabled ? loadBeautifier : skipToken,
    staleTime: Infinity,
  });
}

/**
 * Formats code after the shared beautifier chunk loads. Until then, return trimmed
 * source so code remains readable and copyable instead of showing an empty state.
 * Pass `language: null` to skip loading the formatter and only trim the source.
 */
export function useFormattedCode(options: UseFormattedCodeOptions) {
  const {data: beautify, isPending} = useQuery(
    beautifierQueryOptions(options.language !== null)
  );
  const formattedCode = useMemo(() => {
    if (!beautify || !options.language) {
      return options.code.trim();
    }

    return options.language === 'html'
      ? beautify.html(options.code, options.options)
      : beautify.js(options.code, options.options);
  }, [beautify, options.code, options.language, options.options]);

  return {
    formattedCode,
    isPending: options.language ? isPending : false,
  };
}
