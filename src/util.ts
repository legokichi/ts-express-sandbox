export function asynchronous<T>(fn: (...args: any[])=> any, ctx: any){
  return (...args: any[]): Promise<T> =>{
    return new Promise<T>((resolve)=>{
      fn.apply(ctx, args.concat((...rets: any[])=>{
        resolve(<T><any>rets);
      }));
    });
  };
}