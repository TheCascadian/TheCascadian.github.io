import os
import json
import markdown2
import frontmatter # To read metadata like Title/Date

# Configuration
POSTS_DIR = 'posts'
OUTPUT_FILE = 'posts.json'

def build_blog():
    blog_data = []

    # Loop through every .md file in the /posts folder
    for filename in os.listdir(POSTS_DIR):
        if filename.endswith('.md'):
            with open(os.path.join(POSTS_DIR, filename), 'r') as f:
                # Parse metadata (title, date) and content
                post = frontmatter.load(f)
                
                # Convert Markdown body to HTML
                # extras=["fenced-code-blocks"] allows for nice code snippets
                html_content = markdown2.markdown(post.content, extras=["fenced-code-blocks", "tables"])

                blog_data.append({
                    "id": filename.replace('.md', ''),
                    "title": post.get('title', 'Untitled'),
                    "date": post.get('date', 'Unknown Date'),
                    "excerpt": post.get('excerpt', ''),
                    "content": html_content
                })

    # Sort posts by date (newest first)
    blog_data.sort(key=lambda x: x['date'], reverse=True)

    # Save to JSON
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(blog_data, f, indent=4)
    
    print(f"Successfully bundled {len(blog_data)} posts into {OUTPUT_FILE}")

if __name__ == "__main__":
    build_blog()