/**
 * Taken from https://github.com/rrweb-io/rrweb/blob/master/packages/rrweb/src/replay/canvas/deserialize-args.ts
 * Modified to limit support to only canvas snapshots (rather than draw commands)
 */
import type {Replayer} from '@sentry-internal/rrweb';
import type {CanvasArg} from '@sentry-internal/rrweb-types';
import {decode} from 'base64-arraybuffer';

// TODO: add ability to wipe this list
type GLVarMap = Map<string, any[]>;
type CanvasContexts =
  | CanvasRenderingContext2D
  | WebGLRenderingContext
  | WebGL2RenderingContext;
const webGLVarMap: Map<CanvasContexts, GLVarMap> = new Map();

function variableListFor(ctx: CanvasContexts, ctor: string) {
  let contextMap = webGLVarMap.get(ctx);
  if (!contextMap) {
    contextMap = new Map();
    webGLVarMap.set(ctx, contextMap);
  }
  if (!contextMap.has(ctor)) {
    contextMap.set(ctor, []);
  }

  return contextMap.get(ctor) as any[];
}

export function deserializeCanvasArg(
  imageMap: Replayer['imageMap'],
  ctx: CanvasContexts | null,
  preload?: {
    isUnchanged: boolean;
  }
): (arg: CanvasArg) => Promise<any> {
  return async (arg: CanvasArg): Promise<any> => {
    if (arg && typeof arg === 'object' && 'rr_type' in arg) {
      if (preload) {
        preload.isUnchanged = false;
      }
      if (arg.rr_type === 'ImageBitmap' && 'args' in arg) {
        const args = await deserializeCanvasArg(imageMap, ctx, preload)(arg.args);
        return await createImageBitmap.apply(null, args);
      }
      if ('index' in arg) {
        if (preload || ctx === null) {
          return arg;
        } // we are preloading, ctx is unknown
        const {rr_type: name, index} = arg;
        return variableListFor(ctx, name)[index];
      }
      if ('args' in arg) {
        // XXX: This differs from rrweb, we only support snapshots for now, so
        // this shouldn't be necessary
        // const {rr_type: name, args} = arg;
        //
        // const ctor = window[name as keyof Window];
        //
        // return new ctor(
        //   ...(await Promise.all(args.map(deserializeCanvasArg(imageMap, ctx, preload))))
        // );
        return arg;
      }
      if ('base64' in arg) {
        return decode(arg.base64);
      }
      if ('src' in arg) {
        // XXX: Likewise, snapshots means there will be no need for image support
        // const image = imageMap.get(arg.src);
        // if (image) {
        //   return image;
        // }
        // const newImage = new Image();
        // newImage.src = arg.src;
        // imageMap.set(arg.src, newImage);
        // return newImage;
        return arg;
      }
      if ('data' in arg && arg.rr_type === 'Blob') {
        const blobContents = await Promise.all(
          arg.data.map(deserializeCanvasArg(imageMap, ctx, preload))
        );
        const blob = new Blob(blobContents, {
          type: arg.type,
        });
        return blob;
      }
    } else if (Array.isArray(arg)) {
      const result = await Promise.all(
        arg.map(deserializeCanvasArg(imageMap, ctx, preload))
      );
      return result;
    }
    return arg;
  };
}
