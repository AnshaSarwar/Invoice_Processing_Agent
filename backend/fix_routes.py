with open(r'f:\Documents\Generative AI\InvoSync\backend\app\api\v1\endpoints\invoices.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Split before stream_global
parts = text.split('@router.get("/stream/global"')
if len(parts) == 2:
    top_part = parts[0]
    global_func = '@router.get("/stream/global"' + parts[1]
    
    # Now find where stream_processing is in top_part
    process_parts = top_part.split('@router.get("/stream/{task_id}"')
    
    if len(process_parts) == 2:
        new_text = process_parts[0] + global_func + '\n\n' + '@router.get("/stream/{task_id}"' + process_parts[1]
        with open(r'f:\Documents\Generative AI\InvoSync\backend\app\api\v1\endpoints\invoices.py', 'w', encoding='utf-8') as f:
            f.write(new_text)
        print('Successfully reordered endpoints')
    else:
        print('Could not find stream_processing')
else:
    print('Could not find stream_global')
