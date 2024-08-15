# @uni-ku/define-page

`definePage` 宏，用于动态生成 `pages.json`。

- 支持类型提示、约束
- 支持 json
- 支持函数和异步函数
- 支持从外部导入变量、函数

## 安装

```shell
pnpm i -D @uni-ku/define-page
```

## 配置

### vite 配置
```ts
import uni from '@dcloudio/vite-plugin-uni';
import { viteUniPagesJson } from '@uni-ku/define-page';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    viteUniPagesJson(), // 详细配置请看下面的详细描述
    uni(), // 添加在 viteUniPagesJson() 之后
    // 其他plugins
  ],
});
```

### `definePage` 全局类型声明

将类型添加到 `tsconfig.json` 中的 `compilerOptions.types` 下

```json
{
  "compilerOptions": {
    "types": ["@uni-ku/define-page"]
  }
}
```

### vite 详细配置

```ts
export interface UserConfig {

  /**
   * 项目根目录
   * @default vite 的 `root` 属性
   */
  root?: string;

  /**
   * pages.json 的相对目录
   * @default "src"
   */
  basePath?: string;

  /**
   * 为页面路径生成 TypeScript 声明
   * 接受相对项目根目录的路径
   * null 则取消生成
   * @default basePath
   */
  dts?: string | null;

  /**
   * pages的相对路径
   * @default 'src/pages'
   */
  pages?: string;

  /**
   * subPackages的相对路径
   * @default []
   */
  subPackages?: string[];

  /**
   * 排除条件，应用于 pages 和 subPackages 的文件
   * @default ['node_modules', '.git', '** /__*__/ **']
   */
  exclude?: string[];

  /**
   * pages和subPages的文件扫描深度
   * @default 3
   */
  fileDeep?: number;

  /**
   * 显示调试
   * @default false
   */
  debug?: boolean | DebugType;
}
```

### 全局 `pages.json.(ts|mts|cts|js|cjs|mjs)` 配置

动态配置文件，和 `pages.json` 同级目录。

将与 `definePage` 合并，生成最终的 `pages.json`

```ts
import { UniPagesJson } from '@uni-ku/define-page';

export default UniPagesJson({
  globalStyle: {
    navigationBarTextStyle: 'black',
    navigationBarTitleText: 'uni-app',
    navigationBarBackgroundColor: '#F8F8F8',
    backgroundColor: '#F8F8F8',
  },
  pages: [
    // pages数组中第一项表示应用启动页，参考：https://uniapp.dcloud.io/collocation/pages
    // {
    //   path: 'pages/index/index',
    //   style: {
    //     navigationBarTitleText: 'uni-app',
    //   },
    // },
  ],
});
```

## 使用

### vue SFC文件内 `definePage` 宏使用方式

更多使用方式请参考 [playground/pages/define-page](../playground/src/pages/define-page/)

**注意：**
- 以下代码需要写在 `script setup` 内
- `definePage` 宏和当前 SFC 不同域，且先于 SFC 生成，SFC 内部变量无法使用。
- 页面 path url 将会自动根据文件路径生成，如无须配置其他项目，`definePage`可省略
- 同一个 `script setup` 内仅可使用一个 `definePage`

JSON 对象
```ts
definePage({
  style: {
    navigationBarTitleText: 'hello world',
  },
  middlewares: [
    'auth',
  ],
});
```

函数
```ts
definePage(() => {
  const hello = 'hello';
  const world = 'world';

  return {
    style: {
      navigationBarTitleText: [hello, world].join(' '),
    },
    middlewares: [
      'auth',
    ],
  };
});
```

嵌套函数
```ts
definePage(() => {
  function getTitle(): string {
    const hello = 'hello';
    const world = 'world';

    return [hello, world].join(' ');
  }

  return {
    style: {
      navigationBarTitleText: getTitle(),
    },
    middlewares: [
      'auth',
    ],
  };
});
```

引入外部函数、变量
```ts
import { randamText } from './utils';

definePage(() => {
  return {
    style: {
      navigationBarTitleText: randamText(),
    },
  };
});
```

### 获取当前上下文的数据

```ts
import { ctx } from '@uni-ku/define-page';

console.log(ctx.files);
console.log(ctx.pages);
console.log(ctx.subPackages);
```

## 感谢
- [vite-plugin-uni-pages](https://github.com/uni-helper/vite-plugin-uni-pages)
