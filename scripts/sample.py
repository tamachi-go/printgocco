#!/usr/bin/env python3
"""connpass参加者一覧のモックHTMLとテストデータを生成し、localhostで配信するスクリプト。"""

import argparse
import functools
import html
import http.server
import json
import urllib.parse
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
SAMPLE_DIR = ROOT_DIR / "sample"

DEFAULT_NAMES = [
    ("admin_gopher", "orange range gegegegegege"),
    ("sato_go", "佐藤 太郎"),
    ("suzuki_dev", "鈴木 花子"),
    ("takahashi_k", "高橋 健一"),
    ("tanaka_m", "田中 美咲"),
    ("ito_tech", "伊藤 翔太"),
    ("watanabe_y", "渡辺 結衣"),
    ("yamamoto_r", "山本 亮"),
    ("nakamura_a", "中村 彩"),
    ("kobayashi_d", "小林 大輔"),
    ("kato_n", "加藤 奈々"),
    ("yoshida_k", "吉田 航"),
    ("yamada_s", "山田 颯太"),
    ("sasaki_m", "佐々木 舞"),
    ("yamaguchi_t", "山口 拓海"),
]

PALETTE = [
    "#1e88e5",
    "#43a047",
    "#e53935",
    "#8e24aa",
    "#fb8c00",
    "#00897b",
    "#3949ab",
    "#d81b60",
]


def make_avatar_data_url(label: str, index: int) -> str:
    color = PALETTE[index % len(PALETTE)]
    initial = html.escape(label.strip()[:1] or "?")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 120 120">'
        f'<rect width="120" height="120" fill="{color}"/>'
        '<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" '
        'fill="#ffffff" font-family="sans-serif" font-size="56" font-weight="bold">'
        f"{initial}</text></svg>"
    )
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def build_participants(count: int) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for i in range(count):
        if i < len(DEFAULT_NAMES):
            user_id, display_name = DEFAULT_NAMES[i]
        else:
            num = i + 1
            user_id, display_name = f"participant_{num}", f"テスト参加者 {num}"

        # アイコンあり・なしの両方をテストできるよう、5人ごとにアイコンなしを混ぜる
        icon_url = "" if (i % 5 == 4) else make_avatar_data_url(display_name, i)
        if i < 2:
            role = "Organizer"
        elif i < 5:
            role = "Speaker"
        else:
            role = "Listener"
        result.append(
            {
                "id": user_id,
                "name": display_name,
                "iconUrl": icon_url,
                "role": role,
            }
        )
    return result


def render_rows(users: list[dict[str, str]]) -> str:
    rows = []
    for user in users:
        escaped_id = html.escape(user["id"])
        escaped_name = html.escape(user["name"])
        icon_url = user.get("iconUrl", "")
        img_html = (
            f'<a class="image_link" href="/user/{escaped_id}/">'
            f'<img src="{html.escape(icon_url)}" width="40" height="40" alt="{escaped_name}">'
            f"</a>"
            if icon_url
            else ""
        )
        rows.append(
            f"""          <tr class="user">
            <td class="user_info">
              {img_html}
              <p class="display_name">
                <a href="/user/{escaped_id}/">{escaped_name}</a>
              </p>
            </td>
          </tr>"""
        )
    return "\n".join(rows)


def generate_sample_files(count: int) -> None:
    users = build_participants(count)
    admins = users[:2]
    lt_speakers = users[2:5]
    general = users[5:]
    cancelled = [
        {
            "id": "cancelled_user",
            "name": "キャンセル 太郎（印刷対象外）",
            "iconUrl": "",
            "role": "Listener",
        }
    ]

    event_dir = SAMPLE_DIR / "event" / "406969" / "participation"
    event_dir.mkdir(parents=True, exist_ok=True)

    connpass_html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>Tamachi.go #1 参加者一覧（サンプル） - connpass</title>
  <style>
    body {{
      font-family: sans-serif;
      max-width: 840px;
      margin: 24px auto;
      padding: 0 16px;
      color: #222;
    }}
    .banner {{
      padding: 12px 16px;
      background: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 14px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }}
    th, td {{
      border: 1px solid #ddd;
      padding: 10px 12px;
      text-align: left;
    }}
    th {{
      background: #f5f5f5;
    }}
    td.user_info {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}
    td.user_info img {{
      border-radius: 4px;
      display: block;
    }}
    td.user_info .display_name {{
      margin: 0;
    }}
    .participants_count {{
      margin-left: 8px;
      color: #666;
      font-weight: normal;
    }}
  </style>
</head>
<body>
  <div class="banner">
    <strong>PrintGocco テスト用サンプルページ（参加者 {len(users)} 名）</strong><br>
    このページを開いた状態で Chrome 拡張「PrintGocco」のアイコンをクリックするか、
    <a href="/print.html">直接印刷プレビュー (/print.html)</a> を開いて確認できます。
  </div>

  <h1>Tamachi.go #1 参加者・補欠者一覧（サンプル）</h1>

  <div class="concerned_area">
    <table class="participants_table">
      <thead>
        <tr>
          <th>管理者<span class="participants_count">{len(admins)}人</span></th>
        </tr>
      </thead>
      <tbody>
{render_rows(admins)}
      </tbody>
    </table>
  </div>

  <div id="participants">
    <div class="participation_table_area">
      <table class="participants_table">
        <thead>
          <tr>
            <th>
              <span class="label_ptype_name">登壇枠</span>
              <span class="participants_count">{len(lt_speakers)}人</span>
            </th>
          </tr>
        </thead>
        <tbody>
{render_rows(lt_speakers)}
        </tbody>
      </table>
    </div>

    <div class="participation_table_area">
      <table class="participants_table">
        <thead>
          <tr>
            <th>
              <span class="label_ptype_name">参加枠</span>
              <span class="participants_count">{len(general)}人</span>
            </th>
          </tr>
        </thead>
        <tbody>
{render_rows(general)}
        </tbody>
      </table>
    </div>

    <div class="cancel_table_area">
      <table class="participants_table">
        <thead>
          <tr>
            <th>
              <span class="label_ptype_name">キャンセル</span>
              <span class="participants_count">{len(cancelled)}人</span>
            </th>
          </tr>
        </thead>
        <tbody>
{render_rows(cancelled)}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
"""

    (event_dir / "index.html").write_text(connpass_html, encoding="utf-8")

    participants_json = {
        "participants": [
            {"name": u["name"], "iconUrl": u["iconUrl"], "role": u["role"]}
            for u in users
        ],
    }
    (SAMPLE_DIR / "participants.json").write_text(
        json.dumps(participants_json, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    index_html = """<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>PrintGocco ローカル確認メニュー</title>
  <style>
    body { font-family: sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; line-height: 1.6; }
    li { margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>PrintGocco サンプル確認</h1>
  <ul>
    <li>
      <a href="/sample/event/406969/participation/#participants">
        connpass 参加者一覧モックページを開く
      </a>
      （拡張機能アイコンをクリックして動作確認）
    </li>
    <li>
      <a href="/print.html">
        名刺印刷プレビュー (/print.html) を直接開く
      </a>
      （生成されたテストデータでレイアウトを直接確認）
    </li>
  </ul>
</body>
</html>
"""
    (SAMPLE_DIR / "index.html").write_text(index_html, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="テストデータ入りのconnpassサンプルを生成し、必要に応じてlocalhostで配信します。"
    )
    parser.add_argument(
        "-n",
        "--count",
        type=int,
        default=15,
        help="生成するテスト参加者の人数 (デフォルト: 15)",
    )
    parser.add_argument(
        "--serve",
        action="store_true",
        help="生成後にローカルHTTPサーバーを起動する",
    )
    parser.add_argument(
        "-p",
        "--port",
        type=int,
        default=8000,
        help="HTTPサーバーのポート番号 (デフォルト: 8000)",
    )
    args = parser.parse_args()

    generate_sample_files(max(1, args.count))
    print(f"サンプルデータを生成しました ({args.count}名): {SAMPLE_DIR}")

    if args.serve:
        handler = functools.partial(
            http.server.SimpleHTTPRequestHandler, directory=str(ROOT_DIR)
        )
        with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as httpd:
            print(f"Serving on http://localhost:{args.port}")
            print(
                f"  - connpassモック: http://localhost:{args.port}/sample/event/406969/participation/#participants"
            )
            print(f"  - 印刷プレビュー: http://localhost:{args.port}/print.html")
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nサーバーを停止しました。")


if __name__ == "__main__":
    main()
